/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const { ProvidePlugin, DefinePlugin } = require('webpack');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

const deps = require('./package.json').dependencies;

function getEnvKeys(env) {
    const envs = ['local', 'dev', 'qa', 'uat', 'prod'];
    let environment = '';
    Object.keys(env).forEach((property) => { // receiving env: {"WEBPACK_SERVE":true,"local":true}
        if (envs.includes(property))
            environment = property;
    });
    const currentPath = path.join(__dirname);
    const basePath = `${currentPath}/.env`;
    const envPath = `${currentPath}/envs/.env.${environment}`;

    const finalPath = fs.existsSync(envPath) ? envPath : basePath;
    const fileEnv = dotenv.config({ path: finalPath }).parsed;
    const envKeys = Object.keys(fileEnv).reduce((prev, next) => {
        // eslint-disable-next-line no-param-reassign
        prev[`process.env.${next}`] = JSON.stringify(fileEnv[next]);
        return prev;
    }, {});

    return envKeys;
}

function getOutputDomain(env) {
    return 'http://localhost:8081/';
}

function getOutputDomainShell(env) {
    return 'http://localhost:8080/';
}

// TODO: Remove this function after integrating with chatbot
function exposeRoutes(env) {
    return {
        './MinWebpack': './src/App.tsx',
    };
}

module.exports = (env) => {
    const envKeys = getEnvKeys(env);
    return {
        output: { publicPath: getOutputDomain(env) },

        entry: './src/index.tsx',

        resolve: {extensions: ['.tsx', '.ts', '.jsx', '.js', '.json']},

        devServer: {
            port: 8081,
            historyApiFallback: true,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
            }
        },
        module: {
            unknownContextCritical: false, // suppresses a warning during compile caused by coveo's crypto polyfill which will be fixed in next major release
            rules: [
                {
                    test: /\.m?js/,
                    type: 'javascript/auto',
                    exclude: [/node_modules\/(?!@saffron\/core-components.*)/, /infrastructure/, /api/],
                    resolve: {fullySpecified: false}
                },
                {
                    test: /\.(css|s[ac]ss)$/i,
                    exclude: [/node_modules/, /infrastructure/, /api/],
                    use: ['style-loader', 'css-loader', 'postcss-loader',
                        {
                            loader: 'sass-loader',
                            options: {
                                api: 'modern'
                            }
                        }
                    ]
                },
                {
                    test: /\.css$/,
                    include: path.resolve(__dirname, 'node_modules/graphiql'),
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /\.ts$/,
                    include: path.resolve(__dirname, 'node_modules/@scalar'),
                    use: {loader: 'babel-loader'}
                },
                {
                    test: /\.(js|jsx|ts|tsx)$/,
                    exclude: [/node_modules/, /infrastructure/, /api/],
                    use: {loader: 'babel-loader'}
                },
                {
                    test: /\.(png|jpg|gif|svg|ttf)$/i,
                    type: 'asset/resource'
                },
                {
                    test: /\.json$/,
                    type: 'json'
                }
            ]
        },

        plugins: [
            new DefinePlugin(envKeys),
            new ModuleFederationPlugin({
                name: 'minWebpack',
                filename: 'remoteEntry.js',
                exposes: exposeRoutes(env),
                remotes: { shell: `shell@${getOutputDomainShell(env)}remoteEntry.js` },
                shared: {
                    ...deps,
                    react: {
                        singleton: true,
                        eager: false,
                        requiredVersion: deps.react
                    },
                    'react-dom': {
                        singleton: true,
                        eager: false,
                        requiredVersion: deps['react-dom']
                    }
                }
            }),
            // Automatically imports React when needed
            new ProvidePlugin({React: 'react'}),
            new HtmlWebPackPlugin({template: './src/index.html'})
        ]
    };
};
