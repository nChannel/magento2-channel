function GetSalesOrderFromQuery(ncUtil, channelProfile, flowContext, payload, callback) {
  const nc = require("../util/ncUtils");
  const referenceLocations = ["salesOrderBusinessReferences"];
  const stub = new nc.Stub("GetSalesOrderFromQuery", referenceLocations, ...arguments);

  validateFunction()
    .then(buildQuery)
    .then(searchForOrders)
    .then(buildResponse)
    .catch(handleError)
    .then(() => callback(stub.out))
    .catch(error => {
      logError(`The callback function threw an exception: ${error}`);
      setTimeout(() => {
        throw error;
      });
    });

  async function validateFunction() {
    if (stub.messages.length > 0) {
      stub.messages.forEach(msg => logError(msg));
      stub.out.ncStatusCode = 400;
      throw new Error(`Invalid request [${stub.messages.join(" ")}]`);
    }
    logInfo("Function is valid.");
  }

  async function buildQuery() {
    const query = {
      search_criteria: {
        filter_groups: [],
        page_size: stub.payload.doc.pageSize,
        current_page: stub.payload.doc.page
      }
    };

    if (nc.isNonEmptyString(stub.payload.doc.status)) {
      query.search_criteria.filter_groups.push({
        filters: [
          {
            field: "status",
            value: stub.payload.doc.status
          }
        ]
      });
    }

    if (nc.isInteger(stub.payload.doc.store_id)) {
      query.search_criteria.filter_groups.push({
        filters: [
          {
            field: "store_id",
            value: stub.payload.doc.store_id
          }
        ]
      });
    }

    switch (stub.queryType) {
      case "remoteIDs":
        query.search_criteria.filter_groups.push({
          filters: [
            {
              field: "entity_id",
              value: stub.payload.doc.remoteIDs.join(),
              condition_type: "in"
            }
          ]
        });

        break;

      case "modifiedDateRange":
        query.search_criteria.filter_groups.push({
          filters: [
            {
              field: "updated_at",
              value: nc.moment(stub.payload.doc.modifiedDateRange.startDateGMT).toISOString(),
              condition_type: "gteq"
            }
          ]
        });
        query.search_criteria.filter_groups.push({
          filters: [
            {
              field: "updated_at",
              value: nc.moment(stub.payload.doc.modifiedDateRange.endDateGMT).toISOString(),
              condition_type: "lteq"
            }
          ]
        });

        break;

      case "createdDateRange":
        query.search_criteria.filter_groups.push({
          filters: [
            {
              field: "created_at",
              value: nc.moment(stub.payload.doc.createdDateRange.startDateGMT).toISOString(),
              condition_type: "gteq"
            }
          ]
        });
        query.search_criteria.filter_groups.push({
          filters: [
            {
              field: "created_at",
              value: nc.moment(stub.payload.doc.createdDateRange.endDateGMT).toISOString(),
              condition_type: "lteq"
            }
          ]
        });

        break;

      case "searchFields":
        stub.payload.doc.searchFields.forEach(searchField => {
          query.search_criteria.filter_groups.push({
            filters: [
              {
                field: searchField.searchField,
                value: searchField.searchValues.join(),
                condition_type: "in"
              }
            ]
          });
        });

        break;

      default:
        throw new Error(`Unknown query type: '${stub.queryType}'`);
    }

    return query;
  }

  async function searchForOrders(query) {
    logInfo("Searching for orders matching query...");

    return await stub.request.get({
      url: "/V1/orders",
      qsStringifyOptions: { options: { encode: false } },
      qs: query
    });
  }

  async function buildResponse(response) {
    stub.out.response.endpointStatusCode = response.statusCode;
    stub.out.response.endpointStatusMessage = response.message;
    stub.out.payload = [];

    const orders = response.body.items;
    const pageSize = response.body.search_criteria.page_size;
    const currentPage = response.body.search_criteria.current_page;
    const totalCount = response.body.total_count;
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasMore = currentPage < totalPages;

    logInfo(`Found ${totalCount} total orders.`);
    if (totalCount > 0) {
      logInfo(`Returning page ${currentPage} of ${totalPages} with ${orders.length} orders.`);
    }

    orders.forEach(order => {
      stub.out.payload.push({
        doc: order,
        salesOrderRemoteID: order.entity_id,
        salesOrderBusinessReference: nc.extractBusinessReferences(
          stub.channelProfile.salesOrderBusinessReferences,
          order
        )
      });
    });

    if (orders.length === 0) {
      stub.out.ncStatusCode = 204;
    } else if (hasMore) {
      stub.out.ncStatusCode = 206;
    } else {
      stub.out.ncStatusCode = 200;
    }
  }

  async function handleError(error) {
    logError(error);
    if (error.name === "StatusCodeError") {
      stub.out.response.endpointStatusCode = error.statusCode;
      stub.out.response.endpointStatusMessage = error.message;
      if (error.statusCode >= 500) {
        stub.out.ncStatusCode = 500;
      } else if (error.statusCode === 429) {
        logWarn("Request was throttled.");
        stub.out.ncStatusCode = 429;
      } else {
        stub.out.ncStatusCode = 400;
      }
    }
    stub.out.payload.error = error;
    stub.out.ncStatusCode = stub.out.ncStatusCode || 500;
  }

  function logInfo(msg) {
    stub.log(msg, "info");
  }

  function logWarn(msg) {
    stub.log(msg, "warn");
  }

  function logError(msg) {
    stub.log(msg, "error");
  }
}

module.exports.GetSalesOrderFromQuery = GetSalesOrderFromQuery;
