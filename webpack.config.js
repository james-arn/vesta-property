const Dotenv = require("dotenv-webpack");
const { sentryWebpackPlugin } = require("@sentry/webpack-plugin");
const path = require("path");
const ReplaceInFileWebpackPlugin = require("replace-in-file-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const packageJson = require("./package.json");
const webpack = require("webpack");

const { authConfigs } = require("./src/constants/environmentConfig.js");

const env = process.env.NODE_ENV || "development";

const {
  transformManifestToUseHostPermissionsFromCurrentEnv,
} = require("./src/utils/webpackHelpers.js");

const nodeModulesPath = path.resolve(__dirname, "node_modules");

module.exports = {
  mode: env,
  target: "webworker",
  entry: {
    sidepanel: "./src/sidepanel/index.tsx",
    contentScript: "./src/contentScript/contentScript.ts",
    background: "./src/background.ts",
    offscreen: "./src/offscreen/offscreen.ts",
    sandbox: "./src/sandbox/sandbox.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    publicPath: "",
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
    fallback: {
      path: require.resolve("path-browserify"),
      // Tesseract might require fs, buffer etc. in some environments, add fallbacks if build errors occur
      // fs: false,
      // buffer: require.resolve('buffer/'),
    },
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: "./src/sidepanel/index.html",
      filename: "sidepanel.html",
      chunks: ["sidepanel"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/offscreen/offscreen.html",
      filename: "offscreen.html",
      chunks: ["offscreen"],
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/manifest.json",
          to: "manifest.json",
          // Transform the manifest.json to use the host permissions from the current environment
          // This removes uneccassery requests for permissions from dev environment when installing
          // extension in chrome web store
          transform(content) {
            return transformManifestToUseHostPermissionsFromCurrentEnv(
              content,
              authConfigs,
              env,
              packageJson
            );
          },
        },
        { from: "src/assets/images", to: "images" },
        { from: "src/injectScript.js", to: "injectScript.js" },
        { from: "public/sandbox.html", to: "sandbox.html" },
        { from: "public/welcome.html", to: "welcome.html" },
        {
          from: path.join(nodeModulesPath, "pdfjs-dist/build/pdf.worker.min.mjs"),
          to: "./",
        },
        {
          from: path.join(nodeModulesPath, "tesseract.js/dist/worker.min.js"),
          to: "./",
        },
        {
          from: path.join(nodeModulesPath, "tesseract.js-core"),
          to: "./tesseract-core",
        },
        { from: "public/*.html", to: "[name][ext]" },
        { from: "public/*.js", to: "[name][ext]" },
      ],
    }),
    new Dotenv({
      path: `./.env.${process.env.NODE_ENV}`, // Loads .env.development or .env.production based on NODE_ENV
    }),
    new webpack.DefinePlugin({
      "process.env.PACKAGE_VERSION": JSON.stringify(packageJson.version),
    }),
    // Remove sentry for MVP, reduce permissions required by extension
    // sentryWebpackPlugin({
    //   authToken: process.env.SENTRY_AUTH_TOKEN,
    //   org: "vesta-ja",
    //   project: "vesta",
    //   telemetry: false,
    // }),
    // // stops remote code being loaded in sentry for lazy loading modules that are not used https://browser.sentry-cdn.com - otherwise, rejected from chrome store submission
    // new ReplaceInFileWebpackPlugin([
    //   {
    //     dir: path.resolve(__dirname, "dist"),
    //     files: [
    //       "sidepanel.js",
    //       "sidepanel.js.map",
    //       "background.js",
    //       "background.js.map",
    //       "contentScript.js",
    //       "contentScript.js.map",
    //     ],
    //     rules: [
    //       {
    //         search: /https:\/\/browser\.sentry-cdn\.com/g,
    //         replace: "",
    //       },
    //     ],
    //   },
    // ]),
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
