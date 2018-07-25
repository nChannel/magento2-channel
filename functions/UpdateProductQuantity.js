function UpdateProductQuantity(ncUtil, channelProfile, flowContext, payload, callback) {
  const nc = require("../util/ncUtils");
  const referenceLocations = ["productQuantityBusinessReferences"];
  const stub = new nc.Stub("UpdateProductQuantity", referenceLocations, ...arguments);

  validateFunction()
    .then(updateProductQuantity)
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

  async function updateProductQuantity() {
    logInfo("Updating product quantity...");

    return await stub.request.put({
      url: `/V1/products/${stub.payload.doc.stockItem.sku}/stockItems/${stub.payload.productQuantityRemoteID}`,
      body: stub.payload.doc
    });
  }

  async function buildResponse(response) {
    const stockItemId = response.body;
    stub.payload.doc.stockItem.item_id = stockItemId;
    stub.out.response.endpointStatusCode = response.statusCode;
    stub.out.ncStatusCode = response.statusCode;
    stub.out.payload.productQuantityRemoteID = stockItemId;
    stub.out.payload.productQuantityBusinessReference = nc.extractBusinessReferences(
      stub.channelProfile.productQuantityBusinessReferences,
      stub.payload.doc
    );
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

module.exports.UpdateProductQuantity = UpdateProductQuantity;
