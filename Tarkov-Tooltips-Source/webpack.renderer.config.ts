import type { Configuration } from "webpack";
import path from "path";
import CopyWebpackPlugin from "copy-webpack-plugin";

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

rules.push({
  test: /\.css$/,
  use: [
    { loader: "style-loader" },
    { loader: "css-loader" },
    { loader: "postcss-loader" },
  ],
});

rules.push({
  test: /\.(woff|woff2|eot|ttf|otf)$/i,
  type: "asset/resource",
});

rules.push({
  test: /\.(wav|mp3|ogg|m4a)$/i,
  type: "asset/resource",
});

export const rendererConfig: Configuration = {
  // Copy the maintained Settings status panel into each renderer output.
  // Only main_window/index.html loads it, avoiding any generated-JS hotfixes.
  plugins: [...plugins, new CopyWebpackPlugin({patterns:[{from:path.resolve(__dirname,"renderer/status_panel.js"),to:"main_window/status_panel.js"}]})],
  module: {
    rules,
  },
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css"],
  },
  // target: 'electron-renderer',
};
