'use strict';

const parser = require('billund-source-parser').config;

/**
 * 为lego的config自动生成对应组件的代码
 *
 * @param  {String} source - action的源代码
 * @return {String}
 */
module.exports = function(source) {
    if (!source) return '';
    const dirname = this.context;
    const state = {
        dirname
    };
    return parser.correctTemplate(source, state);
};
