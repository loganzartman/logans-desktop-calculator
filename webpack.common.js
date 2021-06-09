const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

const filenamePattern = "[name].[contenthash].bundle.js";

module.exports = {
  entry: {
    app: "./src/index.ts"
  },
  output: {
    filename: filenamePattern,
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: "src/index.html"
    }),
    new MonacoWebpackPlugin({
      filename: filenamePattern,
      languages:  [],
    }),
  ],
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      {test: /\.tsx?$/, use: "ts-loader"},
      {test: /\.css$/, use: ["style-loader", "css-loader"]},
      {test: /\.ttf$/, use: ["file-loader"]},
    ]
  }
};
