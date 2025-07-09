module.exports = {
  apps: [
    {
      name: "back",
      script: "./back/src/index.js",
      watch: false,
    },
    {
      name: "front",
      script: "npm",
      args: "start",
      cwd: "./front/",
      watch: false,
    }
  ]
};