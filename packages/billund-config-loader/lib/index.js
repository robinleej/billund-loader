'use strict';

const loaderUtils = require('loader-utils');
const packageStaticOnly = require('./static.js');
const packageAll = require('./all.js');

/**
 * 为billund的config自动生成对应config
 *
 * @param  {String} source - action的源代码
 * @return {String}
 */
module.exports = function(source) {
    this.cacheable && this.cacheable();
    let query = {};
    try {
        query = loaderUtils.getOptions(this) || {};
    } catch (e) {
        console.error(`billund-config-loader parse query fail.
    		${e.stack}`);
    }
    // 根据query来进行判断,是否要求打包全部
    const isStaticOnly = query.include === 'static';
    return isStaticOnly ? packageStaticOnly.call(this, source) : packageAll.call(this, source);
};
