function InsertFulfillment(ncUtil, channelProfile, flowContext, payload, callback) {
  const nc = require("../util/ncUtils");
  const referenceLocations = ["fulfillmentBusinessReferences"];
  const stub = new nc.Stub("InsertFulfillment", referenceLocations, ...arguments);

  validateFunction()
    .then(insertShipment)
    //.then(getShipmentDetails)
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

  async function insertShipment() {
    logInfo("Inserting new shipment record...");

    return await stub.request.post({
      url: `/V1/order/${stub.payload.doc.salesOrderRemoteID}/ship`,
      body: stub.payload.doc
    });
  }

  // async function getShipmentDetails(response) {
  //   logInfo(`Getting details for shipment id ${response.body}...`);

  //   return await stub.request.get({
  //     url: `/V1/shipment/${response.body}`
  //   });
  // }

  async function buildResponse(response) {
    stub.out.response.endpointStatusCode = response.statusCode;
    stub.out.ncStatusCode = 201;
    stub.out.payload.fulfillmentRemoteID = response.body.entity_id;
    stub.out.payload.fulfillmentBusinessReference = nc.extractBusinessReferences(
      stub.channelProfile.fulfillmentBusinessReferences,
      response.body
    );
    stub.out.payload.salesOrderRemoteID = response.body.order_id;
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

module.exports.InsertFulfillment = InsertFulfillment;
