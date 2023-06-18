export function mergeOptions(options: object[]): any {
  function nested(objectA: any, objectB: any): any {
    Object.keys(objectB).forEach((key) => {
      if (Object.keys(objectA).includes(key)) {
        if (typeof objectB[key] === "object") {
          nested(objectA[key], objectB[key]);
        } else {
          if (objectB[key]) objectA[key] = objectB[key];
        }
      } else {
        if (objectB[key]) objectA[key] = objectB[key];
      }
    });

    return objectA;
  }

  let value = {};

  options.forEach((option) => {
    if (!option) return;
    value = nested(value, option);
  });

  return value;
}

export const defaultRESTOptions = {
  discord: {
    prefix: "Bot",
    api: "https://discord.com/api",
    versioned: true,
    version: "10",
  },
};

export const defaultGatewayOptions = {
  ws: {
    version: "10",
  },
  shards: "auto",
};
