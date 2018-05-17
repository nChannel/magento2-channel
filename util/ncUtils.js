class Stub {
  constructor(name, referenceLocations, ncUtil, channelProfile, flowContext, payload, callback) {
    this.log(`Beginning ${name}...`);

    // Fail immediately if the callback function is missing or invalid.
    if (!isFunction(callback)) {
      this.log(`The callback function is ${callback == null ? "missing" : "invalid"}.`, "error");
      if (callback == null) {
        throw new Error("A callback function was not provided");
      }
      throw new TypeError("callback is not a function");
    }

    this.name = name;
    this.referenceLocations = referenceLocations;
    this.ncUtil = ncUtil;
    this.channelProfile = channelProfile;
    this.flowContext = flowContext;
    this.payload = payload;
    this.callback = callback;

    this.out = {
      ncStatusCode: null,
      response: {},
      payload: {}
    };

    this.messages = [];

    this.validateNcUtil();
    this.validateChannelProfile();
    this.validateFlowContext();
    this.validatePayload();

    if (!isNonEmptyArray(this.messages)) {
      this.request = require("request-promise-native").defaults({
        auth: {
          bearer: this.channelProfile.channelAuthValues.access_token
        },
        json: true,
        gzip: true,
        simple: true,
        resolveWithFullResponse: true
      });
    }
  }

  log(msg, level = "info") {
    let prefix = `${new Date().toISOString()} [${level}]`;
    if (isNonEmptyString(this.name)) {
      prefix = `${prefix} ${this.name}`;
    }
    console.log(`${prefix} | ${msg}`); // eslint-disable-line no-console
  }

  validateNcUtil() {
    if (!isObject(this.ncUtil)) {
      this.messages.push(`The ncUtil object is ${this.ncUtil == null ? "missing" : "invalid"}.`);
    }
  }

  validateFlowContext() {}

  validatePayload() {
    if (!isObject(this.payload)) {
      this.messages.push(`The payload object is ${this.payload == null ? "missing" : "invalid"}.`);
    } else {
      if (!isObject(this.payload.doc)) {
        this.messages.push(`The payload.doc object is ${this.payload.doc == null ? "missing" : "invalid"}.`);
      }
    }
  }

  validateChannelProfile() {
    if (!isObject(this.channelProfile)) {
      this.messages.push(`The channelProfile object is ${this.channelProfile == null ? "missing" : "invalid"}.`);
    } else {
      if (!isObject(this.channelProfile.channelSettingsValues)) {
        this.messages.push(
          `The channelProfile.channelSettingsValues object is ${
            this.channelProfile.channelSettingsValues == null ? "missing" : "invalid"
          }.`
        );
      } else {
        if (!isNonEmptyString(this.channelProfile.channelSettingsValues.protocol)) {
          this.messages.push(
            `The channelProfile.channelSettingsValues.protocol string is ${
              this.channelProfile.channelSettingsValues.protocol == null ? "missing" : "invalid"
            }.`
          );
        }

        if (!isString(this.channelProfile.channelSettingsValues.store_base_url)) {
          this.messages.push(
            `The channelProfile.channelSettingsValues.store_base_url string is ${
              this.channelProfile.channelSettingsValues.store_base_url == null ? "missing" : "invalid"
            }.`
          );
        }
      }

      if (!isObject(this.channelProfile.channelAuthValues)) {
        this.messages.push(
          `The channelProfile.channelAuthValues object is ${
            this.channelProfile.channelAuthValues == null ? "missing" : "invalid"
          }.`
        );
      } else {
        if (!isNonEmptyString(this.channelProfile.channelAuthValues.access_token)) {
          this.messages.push(
            `The channelProfile.channelAuthValues.access_token string is ${
              this.channelProfile.channelAuthValues.access_token == null ? "missing" : "invalid"
            }.`
          );
        }
      }

      this.referenceLocations.forEach(referenceLocation => {
        if (!isNonEmptyArray(this.channelProfile[referenceLocation])) {
          this.messages.push(
            `The channelProfile.${referenceLocation} array is ${
              this.channelProfile[referenceLocation] == null ? "missing" : "invalid"
            }.`
          );
        }
      });
    }
  }
}

function isFunction(func) {
  return typeof func === "function";
}

function isNonEmptyString(str) {
  return isString(str) && str.trim().length > 0;
}

function isString(str) {
  return typeof str === "string";
}

function isObject(obj) {
  return typeof obj === "object" && obj != null && !isArray(obj);
}

function isNonEmptyObject(obj) {
  return isObject(obj) && Object.keys(obj).length > 0;
}

function isArray(arr) {
  return Array.isArray(arr);
}

function isNonEmptyArray(arr) {
  return isArray(arr) && arr.length > 0;
}

function isNumber(num) {
  return typeof num === "number" && !isNaN(num);
}

function isInteger(int) {
  return isNumber(int) && int % 1 === 0;
}

function extractBusinessReferences(businessReferences, doc, sep = ".") {
  const _get = require("lodash.get");

  if (!isArray(businessReferences)) {
    throw new TypeError("Error: businessReferences must be an Array.");
  } else if (!isObject(doc)) {
    throw new TypeError("Error: doc must be an object.");
  } else if (!(isString(sep) || sep === null)) {
    throw new TypeError("Error: sep must be a string (or null).");
  }

  let values = [];

  businessReferences.forEach(function(businessReference) {
    values.push(_get(doc, businessReference));
  });

  if (sep === null) {
    return values;
  } else {
    return values.join(sep);
  }
}

module.exports = {
  Stub,
  isFunction,
  isNonEmptyString,
  isString,
  isObject,
  isNonEmptyObject,
  isArray,
  isNonEmptyArray,
  isNumber,
  isInteger,
  extractBusinessReferences
};
