const Dotenv = require("dotenv-webpack");
const { sentryWebpackPlugin } = require("@sentry/webpack-plugin");

const path = require("path");
const ReplaceInFileWebpackPlugin = require("replace-in-file-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  mode: process.env.NODE_ENV || "development",
  entry: {
    sidepanel: "./src/sidepanel/index.tsx",
    background: "./src/background.ts",
    contentScript: "./src/contentScript/contentScript.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
      {
        test: /\.(ts|tsx)$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
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
        { from: "src/assets/images", to: "images" },
        { from: "src/injectScript.js", to: "injectScript.js" },
      ],
    }),
    new Dotenv({
      path: `./.env.${process.env.NODE_ENV}`, // Loads .env.development or .env.production based on NODE_ENV
    }),
    sentryWebpackPlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "vesta-ja",
      project: "vesta",
    }),
    // stops remote code being loaded in sentry for lazy loading modules that are not used https://browser.sentry-cdn.com - otherwise, rejected from chrome store submission
    new ReplaceInFileWebpackPlugin([
      {
        dir: path.resolve(__dirname, "dist"),
        files: ["sidepanel.js", "sidepanel.js.map", "background.js", "background.js.map"],
        rules: [
          {
            search: /https:\/\/browser\.sentry-cdn\.com/g,
            replace: "",
          },
        ],
      },
    ]),
  ],
  devtool: "source-map",
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
          },
        },
      }),
    ],
  },
};
