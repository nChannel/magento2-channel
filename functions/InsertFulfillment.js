function InsertFulfillment(ncUtil, channelProfile, flowContext, payload, callback) {
  const nc = require("../util/ncUtils");
  const stub = new nc.Stub("InsertFulfillment", null, ...arguments);

  validateFunction()
    .then(getOrder)
    .then(matchLineItems)
    .then(insertInvoice)
    .then(insertShipment)
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
    if (stub.messages.length === 0) {
      if (stub.flowContext && stub.flowContext.doInvoice) {
        if (!nc.isNonEmptyObject(stub.payload.doc.invoice)) {
          stub.messages.push("The 'doInvoice' flag is true, but no invoice document was provided.");
        }
      }
      if (!nc.isNonEmptyObject(stub.payload.doc.ship)) {
        stub.messages.push("No ship document was provided.");
      }
      if (!nc.isInteger(Number(stub.payload.salesOrderRemoteID))) {
        stub.messages.push(
          `The payload.salesOrderRemoteID integer is ${
            stub.payload.salesOrderRemoteID == null ? "missing" : "invalid"
          }.`
        );
      }
    }

    if (stub.messages.length > 0) {
      stub.messages.forEach(msg => logError(msg));
      stub.out.ncStatusCode = 400;
      throw new Error(`Invalid request [${stub.messages.join(" ")}]`);
    }
    logInfo("Function is valid.");
  }

  async function getOrder() {
    return await stub.request.get({
      url: `/V1/orders/${stub.payload.salesOrderRemoteID}`
    });
  }

  async function matchLineItems(getOrderResponse) {
    const order = getOrderResponse.body;

    if (nc.isNonEmptyObject(stub.payload.doc.invoice) && nc.isNonEmptyArray(stub.payload.doc.invoice.items)) {
      stub.payload.doc.invoice.items.forEach(item => {
        if (nc.isNonEmptyString(item.sku)) {
          const orderItem = order.items.find(i => i.sku === item.sku);
          if (orderItem != null) {
            item.orderItemId = orderItem.item_id;
            delete item.sku;
          } else {
            throw new Error(`Order ${order.entity_id} does not have a line item matching invoice sku ${item.sku}.`);
          }
        }
      });
    }

    if (nc.isNonEmptyObject(stub.payload.doc.ship) && nc.isNonEmptyArray(stub.payload.doc.ship.items)) {
      stub.payload.doc.ship.items.forEach(item => {
        if (nc.isNonEmptyString(item.sku)) {
          const orderItem = order.items.find(i => i.sku === item.sku);
          if (orderItem != null) {
            item.orderItemId = orderItem.item_id;
            delete item.sku;
          } else {
            throw new Error(`Order ${order.entity_id} does not have a line item matching ship sku ${item.sku}.`);
          }
        }
      });
    }
  }

  async function insertInvoice() {
    if (stub.flowContext && stub.flowContext.doInvoice) {
      logInfo("Inserting new invoice record...");

      return await stub.request.post({
        url: `/V1/order/${stub.payload.salesOrderRemoteID}/invoice`,
        body: stub.payload.doc.invoice
      });
    }
  }

  async function insertShipment() {
    logInfo("Inserting new shipment record...");

    try {
      return await stub.request.post({
        url: `/V1/order/${stub.payload.salesOrderRemoteID}/ship`,
        body: stub.payload.doc.ship
      });
    } catch (error) {
      if (stub.flowContext && stub.flowContext.doInvoice) {
        if (error.statusCode >= 500 || error.statusCode === 429) {
          // Force statusCode to 400 if we have already completed invoice successfully to prevent unwanted retries.
          stub.out.ncStatusCode = 400; // Retrying could result in duplicate invoices and/or captured payments.
          logError("The invoice was inserted successfully, but the shipment insertion has failed.");
        }
      }
      throw error;
    }
  }

  async function buildResponse(response) {
    stub.out.response.endpointStatusCode = response.statusCode;
    stub.out.ncStatusCode = 201;
    stub.out.payload.fulfillmentRemoteID = response.body;
    stub.out.payload.salesOrderRemoteID = stub.payload.salesOrderRemoteID;
  }

  async function handleError(error) {
    logError(error);
    if (error.name === "StatusCodeError") {
      stub.out.response.endpointStatusCode = error.statusCode;
      stub.out.response.endpointStatusMessage = error.message;
      if (error.statusCode >= 500) {
        stub.out.ncStatusCode = stub.out.ncStatusCode || 500;
      } else if (error.statusCode === 429) {
        logWarn("Request was throttled.");
        stub.out.ncStatusCode = stub.out.ncStatusCode || 429;
      } else {
        stub.out.ncStatusCode = stub.out.ncStatusCode || 400;
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

module.exports.InsertFulfillment = InsertFulfillment;
