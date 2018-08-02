function UpdateProductPricing(ncUtil, channelProfile, flowContext, payload, callback) {
  const nc = require("../util/ncUtils");
  const referenceLocations = ["productPricingBusinessReferences"];
  const stub = new nc.Stub("UpdateProductPricing", referenceLocations, ...arguments);

  validateFunction()
    .then(updateProductPricing)
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

  async function updateProductPricing() {
    logInfo("Updating product pricing...");

    return await stub.request.put({
      url: `/V1/products/${stub.payload.doc.product.sku}`,
      body: stub.payload.doc
    });
  }

  async function buildResponse(response) {
    const product = response.body;
    stub.out.response.endpointStatusCode = response.statusCode;
    stub.out.ncStatusCode = response.statusCode;
    stub.out.payload.productPricingRemoteID = product.id;
    stub.out.payload.productPricingBusinessReference = nc.extractBusinessReferences(
      stub.channelProfile.productPricingBusinessReferences,
      product
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

module.exports.UpdateProductPricing = UpdateProductPricing;
