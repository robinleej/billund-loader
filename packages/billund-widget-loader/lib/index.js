'use strict';

const babylon = require('babylon');
const traverse = require('babel-traverse').default;
const babelTypes = require('babel-types');

module.exports = function(source) {
    if (this.cacheable) this.cacheable();
    /*
    	1.widget目前的配置都会是一个json，然后我们解除所有的值
    	2.通过babel解析出所有的属性值
    	3.生成对应的模板
     */
    let value = typeof source === 'string' ? JSON.parse(source) : source;
    value = JSON.stringify(value)
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    value = `module.exports = ${value}`;

    const ast = babylon.parse(value);
    const propertiesMap = {};
    traverse(ast, {
        MemberExpression(nodePath) {
            const isModuleExports = nodePath.node.object.name == 'module' && nodePath.node.property.name == 'exports';
            if (!isModuleExports) return;

            const parentPath = nodePath.findParent((pa) => pa.isAssignmentExpression());
            const exportsObj = parentPath.node.right;
            if (!babelTypes.isObjectExpression(exportsObj)) throw new Error('sorry, for lego widget cfg please export an object.');

            const properties = exportsObj.properties || [];
            properties.forEach((property) => {
                const propertyVal = property.value;
                if (!(babelTypes.isLiteral(propertyVal) || babelTypes.isStringLiteral(propertyVal))) return;
                propertiesMap[property.key.name] = propertyVal.value;
            });
        }
    });

    // 进行校验，至少要有两个属性name,template
    if (!(propertiesMap.name && propertiesMap.template)) {
        this.emitError('name and template are required!');
        return '';
    }

    const isServer = this.target === 'node';
    const dataGeneratorStr = propertiesMap.dataGenerator ?
        `
        const dataGenerator = require('${propertiesMap.dataGenerator}');
        ` :
        `
        const dataGenerator = function* (params) {
        	return params;
        };
        `;

    return `
    	'use strict';

		const co = require('co');
		${dataGeneratorStr}
		const template = require('${propertiesMap.template}');

		function getInnerComponent(initalData) {
    		return {
        		components: {
            		'wrapped-element': template
        		},
        		render(h) {
        			/*
        			 	注意，每次更新的时候，都希望dataGenerator的返回值作为优先级更高的值
        			 */
            		const props = this.$attrs;
            		return h('wrapped-element', {
                		props: Object.assign({}, props, initalData);
            		});
        		}
    		};
		}

		function getComponent() {
    		let vm = null; // 用以cache vue的上下文
    		const listeners = [];

    		function getVm(cb) {
        		if (!vm) {
            		listeners.push(cb);
            		return;
        		}
        		listeners.forEach((fn) => {
            		fn && fn(vm);
        		});
    		}

    		function setVm($vm) {
        		if (vm) return;
        		vm = $vm;
        		listeners.forEach((fn) => {
            		fn && fn($vm);
        		});
    		}
    		const vmp = new Promise((resolve) => {
        		getVm(($vm) => {
            		resolve($vm);
        		});
    		});

    		const wp = new Promise((resolve, reject) => {
        		vmp.then(($vm) => {
        			const ctx = $vm.$root.legoCtx;
        			if(!ctx.legoConfig.legoComponents) {
        				ctx.legoConfig.legoComponents = {};
        			}
        			if(!ctx.legoConfig.legoComponents['${propertiesMap.name}']){
        				ctx.legoConfig.legoComponents['${propertiesMap.name}'] = 0;
        			}
        			ctx.legoConfig.legoComponents['${propertiesMap.name}']++;
        			const widgetId = '${propertiesMap.name}' + ctx.legoConfig.legoComponents['${propertiesMap.name}'];
            		const dg = dataGenerator.call(ctx, vm.$attrs);
            		co(dg).then((data) => {
                		// send data to store
                		resolve(getInnerComponent(data));
            		})
        		});
    		});
    		return {
        		// 这里可以考虑用高级异步组件
        		components: {
            		'wrapped-element': (resolve) => {
                		return wp;
            		}
        		},
        		render(h) {
            		setVm(this);
            		return h('wrapped-element', {
                		props: this.$attrs
            		});
        		}
    		};
		}

		module.exports = {
    		getComponent
		};
    `;
};