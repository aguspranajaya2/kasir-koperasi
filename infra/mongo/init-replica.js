try {
  rs.status();
  print("Replica set rs0 already initialized");
} catch {
  // The API runs on the host during local development, so advertise the published host port.
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] });
  print("Replica set rs0 initialized");
}
