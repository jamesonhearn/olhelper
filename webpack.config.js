const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const devCerts = require("office-addin-dev-certs");
const dotenv = require("dotenv");
const path = require("path");
const webpack = require("webpack");

dotenv.config({
  path: path.resolve(__dirname, ".env.local"),
  quiet: true,
});

module.exports = async (_env, argv) => {
  const isDevelopment = argv.mode === "development";
  const devServer = isDevelopment
    ? {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        hot: true,
        port: 3000,
        server: {
          type: "https",
          options: await devCerts.getHttpsServerOptions(),
        },
      }
    : undefined;

  return {
    devtool: isDevelopment ? "source-map" : false,
    entry: {
      taskpane: "./src/taskpane/taskpane.ts",
      commands: "./src/commands/commands.ts",
    },
    output: {
      clean: true,
      filename: isDevelopment ? "[name].js" : "[name].[contenthash].js",
      path: path.resolve(__dirname, "dist"),
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: "ts-loader",
        },
        {
          test: /\.css$/,
          use: [
            isDevelopment ? "style-loader" : MiniCssExtractPlugin.loader,
            "css-loader",
          ],
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        "process.env.OLHELPER_CLIENT_ID": JSON.stringify(
          process.env.OLHELPER_CLIENT_ID ?? "",
        ),
        "process.env.OLHELPER_TENANT_ID": JSON.stringify(
          process.env.OLHELPER_TENANT_ID ?? "",
        ),
      }),
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["taskpane"],
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["commands"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "assets", to: "assets" },
          { from: "src/404.html", to: "404.html" },
          { from: "staticwebapp.config.json", to: "staticwebapp.config.json" },
        ],
      }),
      ...(!isDevelopment
        ? [
            new MiniCssExtractPlugin({
              filename: "[name].[contenthash].css",
            }),
          ]
        : []),
    ],
    ...(devServer ? { devServer } : {}),
  };
};
