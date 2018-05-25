function UpdateCustomer(ncUtil, channelProfile, flowContext, payload, callback) {
  const nc = require("../util/ncUtils");
  const referenceLocations = ["customerBusinessReferences"];
  const stub = new nc.Stub("UpdateCustomer", referenceLocations, ...arguments);

  validateFunction()
    .then(lookupCustomer)
    .then(combineAddresses)
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

  async function lookupCustomer() {
    logInfo("Getting existing customer details...");

    return await stub.request.get({
      url: `/V1/customers/${stub.payload.customerRemoteID}`
    });
  }

  async function combineAddresses(response) {
    const existingCustomer = response.body;
    const newCustomer = stub.payload.doc.customer;

    switch (flowContext.addressUpdateMethod) {
      case "append":
        logInfo("Appending new addresses to existing customer address collection.");

        if (nc.isNonEmptyArray(existingCustomer.addresses)) {
          if (nc.isArray(newCustomer.addresses)) {
            newCustomer.addresses.push(...existingCustomer.addresses);
          } else {
            newCustomer.addresses = existingCustomer.addresses;
          }
        }

        break;

      case "merge":
        logInfo("Attempting to match new addresses with existing ones and merge the 2 collections together.");
        if (nc.isNonEmptyArray(existingCustomer.addresses) && !nc.isNonEmptyArray(newCustomer.addresses)) {
          newCustomer.addresses = existingCustomer.addresses;
        } else if (nc.isNonEmptyArray(existingCustomer.addresses) && nc.isNonEmptyArray(newCustomer.addresses)) {
          const expression = nc.jsonata(flowContext.addressMatchingExpression);
          for (let e = 0; e < existingCustomer.addresses.length; e++) {
            let eUsed = false;
            for (let n = 0; n < newCustomer.addresses.length; n++) {
              if (newCustomer.addresses[n].id == null && !eUsed) {
                if (
                  expression.evaluate(existingCustomer.addresses[e]) === expression.evaluate(newCustomer.addresses[n])
                ) {
                  newCustomer.addresses[n].id = existingCustomer.addresses[e].id;
                  eUsed = true;
                  break;
                }
              }
            }
            if (!eUsed) {
              newCustomer.addresses.push(existingCustomer.addresses[e]);
            }
          }
        }
        break;

      case "replace":
      default:
        logInfo("The new addresses array will completely replace the existing addresses array.");
    }

    return newCustomer;
  }

  async function updateCustomer(customer) {
    logInfo("Updating existing customer record...");

    return await stub.request.put({
      url: `/V1/customers/${stub.payload.customerRemoteID}`,
      body: { customer: customer }
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

module.exports.UpdateCustomer = UpdateCustomer;
