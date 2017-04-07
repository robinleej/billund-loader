'use strict';

const babylon = require('babylon');
const traverse = require('babel-traverse').default;
const babelTypes = require('babel-types');
const generate = require('babel-generator').default;
const parser = require('billund-source-parser').config;

const availabelKeys = ['name', 'actions', 'constants'];

/**
 * 为lego的config自动生成对应config
 *
 * @param  {String} source - action的源代码
 * @return {String}
 */
module.exports = function(source) {
    if (!source) return '';
    const extractResult = parser.extractRequireAndExport(source);

    const requireMap = extractResult.requireMap || {};
    const exportMap = extractResult.exportMap || {};

    /*
        1.遍历exportMap,如果发现是需要保留的require的值,那么就记录对应的key
        2.将require的值生成code-path
        3.将export出来的值生成code-path,并且追加WIDGET_NAME字段
        4.将整个内容进行替换，生成代码节点
     */
    const availabelRequireKeys = [];
    availabelKeys.forEach((key) => {
        if (!exportMap[key]) return true;
        if (!babelTypes.isIdentifier(exportMap[key])) return true;

        availabelRequireKeys.push(exportMap[key].name);
    });

    const importNodes = availabelRequireKeys.map((key) => {
        const fromPath = requireMap[key];
        const keyNode = babelTypes.identifier(key);
        const fromPathNode = babelTypes.stringLiteral(fromPath);
        return babelTypes.importDeclaration(
            [babelTypes.importDefaultSpecifier(keyNode)], fromPathNode);
    });

    const exportProperties = availabelKeys.map((key) => {
        const value = exportMap[key];
        if (!value) return '';

        const keyNode = babelTypes.identifier(key);
        return babelTypes.objectProperty(keyNode, value);
    }).filter((value) => {
        return !!value;
    });

    // 兼容模式,加一个WIDGET_NAME key,值与name相同
    if (exportMap.name) {
        const value = exportMap.name;
        const keyNode = babelTypes.identifier('WIDGET_NAME');
        exportProperties.push(babelTypes.objectProperty(keyNode, value));
    }

    const exportNode = babelTypes.exportDefaultDeclaration(babelTypes.objectExpression(exportProperties));

    const newProgram = babelTypes.program((importNodes || []).concat([exportNode]));

    const ast = babylon.parse(source);
    traverse(ast, {
        Program(nodePath) {
            nodePath.replaceWith(newProgram);
        }
    });

    return generate(ast, {}).code;
};
