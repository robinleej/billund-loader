'use strict';

const babylon = require('babylon');
const traverse = require('babel-traverse').default;
const babelTypes = require('babel-types');
const generate = require('babel-generator').default;

const Enums = require('billund-enums');
const SupportorEnums = Enums.supportor;
const SUPPORTOR_NAME = SupportorEnums.BROWSER_SUPPORTOR_PACKAGE_NAME;
const SUPPORTOR_FN_NAME = SupportorEnums.BROWSER_SUPPORTOR_REGIST_PREPROCESSOR_NAME;

/**
 * 生成lego-supportor调用的节点
 *
 * @param  {Object} exportFn - 暴露出去的方法的expression
 * @return {Object}
 */
function genRequireExpression(exportFn) {
    const requireExpression = babelTypes.callExpression(babelTypes.identifier('require'), [babelTypes.stringLiteral(SUPPORTOR_NAME)]);
    const memberExpression = babelTypes.memberExpression(requireExpression, babelTypes.identifier(SUPPORTOR_FN_NAME));
    const useFnExpression = babelTypes.callExpression(memberExpression, [exportFn]);
    return babelTypes.expressionStatement(useFnExpression);
}

/**
 * 为billund的支持组件自动生成调用
 *
 * @param  {String} source - action的源代码
 * @return {String}
 */
module.exports = function(source) {
    this && this.cacheable && this.cacheable();
    if (!source) return '';

    /*
    	我们约定，需要暴露的是预处理函数
    	1.module.exports
    	2.export default
    	全都转化成require('billund-supportor').useContextPreProcessor
     */
    const ast = babylon.parse(source);
    traverse(ast, {
        MemberExpression(nodePath) {
            const isModuleExports = nodePath.node.object.name == 'module' && nodePath.node.property.name == 'exports';
            if (!isModuleExports) return;

            const parentPath = nodePath.findParent((pa) => pa.isAssignmentExpression());
            const exportFn = parentPath.node.right;

            parentPath.replaceWith(genRequireExpression(exportFn));
        },
        ExportDefaultDeclaration(nodePath) {
            const exportFn = nodePath.node.declaration;
            nodePath.replaceWith(genRequireExpression(exportFn));
        }
    });

    return generate(ast, {}).code;
};
