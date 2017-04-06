'use strict';

const os = require('os');
const _ = require('lodash');
const loaderUtils = require('loader-utils');
const SupportorEnums = require('billund-enums').supportor;
const widgetUtils = require('billund-utils').widget;

const actionParser = require('billund-source-parser').action;

const BILLUND_SUPPORTOR_IDENTIFIER = 'BillundSupportor';
// 默认的widget-loader
const DEFAULT_WIDGET_LOADERS = [{
    loader: 'babel-loader'
}, {
    loader: 'billund-config-loader',
    options: {
        include: 'all'
    }
}];

/**
 * 为lego的action层级自动生成静态资源的loader
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
        console.error(`billund-action-loader parse query fail.
            ${e.stack}`);
    }

    /*
        step:
        1.先拿取query中的widgetName -> widgetPath 的映射关系,通过源码解析action拿取所有的widget
        2.转换loaders为对应的字符串式引用
        3.区分核心模块和非核心模块，生成代码
     */
    const widgetNameToPath = query.widgetNameToPath || {};
    const widgetNames = Object.keys(widgetNameToPath);
    if (!(widgetNames && widgetNames.length)) {
        console.warn(`missing widgetNameToPath in billund-action-loader option-query`);
        return '';
    }
    const widgets = actionParser.extractWidgetInfos(source, {
        widgetNames
    });
    if (!(widgets && widgets.length)) return '';

    // 拼接loaderStr
    const widgetLoaders = query.widgetLoaders || DEFAULT_WIDGET_LOADERS;
    const widgetLoaderRequests = widgetLoaders.map((loader) => {
        const stringifyOptions = loader.options ? JSON.stringify(loader.options) : '';
        return `${loader.loader}${stringifyOptions ? ('?' + stringifyOptions) : ''}`;
    });
    const requirePrefix = `!${widgetLoaderRequests.join('!')}!`;

    // 根据weight区分核心模块与非核心模块
    const mostImportantWidgets = widgetUtils.extractImportantWidgets(widgets);
    const otherWidgets = _.difference(widgets, mostImportantWidgets);

    const mostImportantWidgetsSource = mostImportantWidgets.map((widget) => {
        return `${BILLUND_SUPPORTOR_IDENTIFIER}.registWidgetModule(require('${requirePrefix}${widgetNameToPath[widget.name]}'));`;
    }).join(os.EOL);

    const otherWidgetsSource = otherWidgets.map((widget) => {
        return `'${requirePrefix}${widgetNameToPath[widget.name]}'`;
    }).join(',');
    return `
        'use strict';
        var ${BILLUND_SUPPORTOR_IDENTIFIER} = require('${SupportorEnums.BROWSER_SUPPORTOR_PACKAGE_NAME}');
        ${mostImportantWidgetsSource}

        var addEventListener = (function() {
            var _events = document.addEventListener ? 'addEventListener' : 'attachEvent';
            return function(el, type, fn) {
                el[_events]((document.addEventListener ? '' : 'on') + type, fn);
            };
        })();
        var removeEventListener = (function() {
            var _events = document.removeEventListener ? 'removeEventListener' : 'detachEvent';
            return function(el, type, fn) {
                el[_events](type, fn);
            };
        })();

        var isExecuted = false;
        function resolve() {
            if (isExecuted) return;

            isExecuted = true;
            require([${otherWidgetsSource}], function() {
                Array.prototype.slice.call(arguments).forEach(function(widget){
                    ${BILLUND_SUPPORTOR_IDENTIFIER}.registWidgetModule(widget);
                });
                console.log('lego require async done.');
            });
        }

        function domReady() {
            var fns = [];
            var listener = null;
            var hack = document.documentElement.doScroll;
            var domContentLoaded = 'DOMContentLoaded';
            var loaded = (hack ? /^loaded|^c/ : /^loaded|^i|^c/).test(document.readyState);

            if (!loaded) {
                addEventListener(window, domContentLoaded, listener = function() {
                    removeEventListener(window, domContentLoaded, listener);
                    loaded = 1;
                    while ((listener = fns.shift())) {
                        listener();
                    }
                });
            }
            return function(fn) {
                loaded ? setTimeout(fn, 0) : fns.push(fn);
            };
        }

        if (document.readyState === 'complete') {
            window.setTimeout(function(){
                resolve();
            }, 5);
            return;
        }

        domReady()(function() {
            window.setTimeout(function() {
                resolve();
            }, 1500);
        });

        addEventListener(window, 'load', function() {
            window.setTimeout(function() {
                resolve();
            }, 5);
        });
    `;
};
