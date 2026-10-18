const desiredHost = "mongodb:27017";
let config = null;

try {
  config = rs.conf();
} catch {
  // A new volume has not had its single-node replica set initialized yet.
}

if (!config) {
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: desiredHost }] });
  print(`Replica set rs0 initialized with ${desiredHost}`);
} else {
  if (config._id !== "rs0" || config.members.length !== 1 || config.members[0]._id !== 0) {
    throw new Error("Expected the local single-member replica set named rs0");
  }

  if (config.members[0].host !== desiredHost) {
    // This is a single-node local Docker replica set. Repoint it from the old
    // host-side address (127.0.0.1:27017) without dropping the data volume.
    config.members[0].host = desiredHost;
    config.version += 1;
    rs.reconfig(config, { force: true });
    print(`Replica set rs0 address changed to ${desiredHost}`);
  } else {
    print(`Replica set rs0 already uses ${desiredHost}`);
  }
}
