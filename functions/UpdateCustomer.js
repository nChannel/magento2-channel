function UpdateCustomer(ncUtil, channelProfile, flowContext, payload, callback) {
  const nc = require("../util/ncUtils");
  const referenceLocations = ["customerBusinessReferences"];
  const stub = new nc.Stub("UpdateCustomer", referenceLocations, ...arguments);

  validateFunction()
    .then(updateCustomer)
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
    if (stub.messages.length === 0) {
      if (!nc.isInteger(stub.payload.customerRemoteID)) {
        stub.messages.push(
          `The payload.customerRemoteID integer is ${stub.payload.customerRemoteID == null ? "missing" : "invalid"}.`
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

  async function updateCustomer() {
    logInfo("Updating existing customer record...");

    return await stub.request.put({
      url: `/V1/customers/${stub.payload.customerRemoteID}`,
      body: stub.payload.doc
    });
  }

  async function buildResponse(response) {
    const customer = response.body;
    stub.out.response.endpointStatusCode = response.statusCode;
    stub.out.ncStatusCode = response.statusCode;
    stub.out.payload.customerRemoteID = customer.id;
    stub.out.payload.customerBusinessReference = nc.extractBusinessReferences(
      stub.channelProfile.customerBusinessReferences,
      customer
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
}

module.exports.UpdateCustomer = UpdateCustomer;
