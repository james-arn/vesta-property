const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  mode: "development",
  entry: {
    sidepanel: "./src/sidepanel/index.tsx",
    background: "./src/background.js"
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: "./src/sidepanel/index.html",
      filename: "sidepanel.html",
      chunks: ["sidepanel"],
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "src/manifest.json" },
        { from: "src/images", to: "images" },
      ],
    }),
  ],
  devtool: 'source-map',
};
