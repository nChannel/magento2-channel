function CheckForCustomer(ncUtil, channelProfile, flowContext, payload, callback) {
  const nc = require("../util/ncUtils");
  const referenceLocations = ["customerBusinessReferences"];
  const stub = new nc.Stub("CheckForCustomer", referenceLocations, ...arguments);

  validateFunction()
    .then(searchForCustomer)
    .then(buildResponse)
    .catch(handleError)
    .then(() => callback(stub.out))
    .catch(error => {
      logError(`The callback function threw an exception: ${error}`);
      setTimeout(() => {
        throw error;
      });
    });

  function logInfo(msg) {
    stub.log(msg, "info");
  }

  function logWarn(msg) {
    stub.log(msg, "warn");
  }

  function logError(msg) {
    stub.log(msg, "error");
  }

  async function validateFunction() {
    if (stub.messages.length > 0) {
      stub.messages.forEach(msg => logError(msg));
      stub.out.ncStatusCode = 400;
      throw new Error(`Invalid request [${stub.messages.join(" ")}]`);
    }
    logInfo("Function is valid.");
  }

  async function searchForCustomer() {
    logInfo("Searching for existing customer...");

    const query = {
      search_criteria: {
        filter_groups: [],
        page_size: 1,
        current_page: 1
      },
      fields: "total_count,search_criteria,items[id"
    };

    stub.channelProfile.customerBusinessReferences.forEach(refName => {
      const refValue = nc.extractBusinessReferences([refName], stub.payload.doc);
      query.search_criteria.filter_groups.push({ filters: [{ field: refName, value: refValue }] });
      query.fields = query.fields.concat(`,${refName}`);
    });
    query.fields = query.fields.concat("]");

    return await stub.request.get({
      url: "/V1/customers/search",
      qsStringifyOptions: { options: { encode: false } },
      qs: query
    });
  }

  async function buildResponse(response) {
    const customers = response.body.items;
    stub.out.response.endpointStatusCode = response.statusCode;

    if (!nc.isArray(customers)) {
      throw new TypeError(`Search response is not an array. Response: ${JSON.stringify(response.body, null, 2)}`);
    }

    if (customers.length === 1) {
      if (!nc.isObject(customers[0]) || !nc.isNonEmptyString(customers[0].id)) {
        throw new TypeError(
          `Customer object is not in expected format. Response: ${JSON.stringify(response.body, null, 2)}`
        );
      }
      logInfo(`Found an existing customer: ${JSON.stringify(customers[0], null, 2)}`);
      stub.out.ncStatusCode = 200;
      stub.out.payload.customerRemoteID = customers[0].id;
      stub.out.payload.customerBusinessReference = nc.extractBusinessReferences(
        stub.channelProfile.customerBusinessReferences,
        customers[0]
      );
    } else if (customers.length === 0) {
      logInfo("Customer does not exist.");
      stub.out.ncStatusCode = 204;
    } else {
      logWarn("Multiple customers matched query.");
      stub.out.payload.error = new Error(
        `Search returned multiple customers. Response: ${JSON.stringify(response.body, null, 2)}`
      );
      stub.out.ncStatusCode = 409;
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
}

module.exports.CheckForCustomer = CheckForCustomer;
