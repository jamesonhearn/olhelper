const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");
const webpack = require("webpack");

module.exports = {
  devtool: false,
  entry: {
    taskpane: "./src/taskpane/taskpane.ts",
    commands: "./src/commands/commands.ts",
    sessionEnded: "./src/session-ended/session-ended.ts",
  },
  output: {
    clean: true,
    filename: "[name].[contenthash].js",
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
        use: {
          loader: "esbuild-loader",
          options: {
            loader: "ts",
            target: "es2022",
          },
        },
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
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
    new HtmlWebpackPlugin({
      filename: "session-ended.html",
      template: "./src/session-ended/session-ended.html",
      chunks: ["sessionEnded"],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "assets", to: "assets" },
        { from: "src/index.html", to: "index.html" },
        { from: "src/404.html", to: "404.html" },
        { from: "staticwebapp.config.json", to: "staticwebapp.config.json" },
      ],
    }),
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
    }),
  ],
};
