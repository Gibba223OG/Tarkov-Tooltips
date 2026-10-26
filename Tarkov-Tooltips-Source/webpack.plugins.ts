/* eslint-disable @typescript-eslint/no-var-requires */
import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
// const CopyPlugin = require('copy-webpack-plugin')

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
  // new CopyPlugin({
  //   patterns: [
  //     { from: "lib", to: "lib" },
  //     { from: "eng.traineddata", to: "eng.traineddata" },
  //   ],
  // }),
];
