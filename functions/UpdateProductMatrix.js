function UpdateProductMatrix(ncUtil, channelProfile, flowContext, payload, callback) {
  const nc = require("../util/ncUtils");
  const referenceLocations = ["productBusinessReferences"];
  const stub = new nc.Stub("UpdateProductMatrix", referenceLocations, ...arguments);

  validateFunction()
    .then(insertChildren)
    .then(insertMatrix)
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

  async function insertChildren() {
    logInfo("Inserting child product records...");
    return await Promise.all(stub.payload.doc.matrixChildren.map(insertProduct));
  }

  async function insertProduct(product) {
    logInfo("Inserting product record...");
    return await stub.request.post({ url: "/V1/products", body: product });
  }

  async function insertMatrix(children) {
    logInfo("Building matrix product...");
    delete stub.payload.doc.matrixChildren;
    if (!stub.payload.doc.product.extension_attributes) {
      stub.payload.doc.product.extension_attributes = {};
    }
    if (!stub.payload.doc.product.extension_attributes.configurable_product_links) {
      stub.payload.doc.product.extension_attributes.configurable_product_links = [];
    }
    stub.payload.doc.product.extension_attributes.configurable_product_links.push(...children.map(child => child.id));
    return await insertProduct(stub.payload.doc);
  }

  async function buildResponse(response) {
    const product = response.body;
    stub.out.response.endpointStatusCode = response.statusCode;
    stub.out.ncStatusCode = 200;
    stub.out.payload.productRemoteID = product.id;
    stub.out.payload.productBusinessReference = nc.extractBusinessReferences(
      stub.channelProfile.productBusinessReferences,
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

module.exports.UpdateProductMatrix = UpdateProductMatrix;
