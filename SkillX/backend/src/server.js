const { app } = require("./app");
const { port } = require("./config/env");

app.listen(port, () => {
  // Intentional startup log for container and local visibility.
  console.log(`Backend listening on port ${port}`);
});
