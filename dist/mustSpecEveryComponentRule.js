"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Lint = require("tslint");
var sprintf_js_1 = require("sprintf-js");
var ngWalker_1 = require("codelyzer/angular/ngWalker");
var path = require("path");
var glob = require("glob");
var SyntaxKind = require("codelyzer/util/syntaxKind");
var fs = require("fs");
var Rule = (function (_super) {
    __extends(Rule, _super);
    function Rule() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Rule.prototype.apply = function (sourceFile) {
        return this.applyWithWalker(new ComponentSpecSearcher(sourceFile, this));
    };
    Rule.metadata = {
        ruleName: 'must-spec-every-component',
        type: 'maintainability',
        description: "Ensure that classes all classes have spec files.",
        options: null,
        optionsDescription: "Not configurable.",
        typescriptOnly: true,
    };
    Rule.SPEC_FAILURE_STRING = 'In the class "%s", there is a missing'
        + ' spec file at the location "%s".  Please create it.';
    Rule.SPEC_METHOD_FAILURE_STRING = 'In the class "%s", there is a missing'
        + ' spec description for the method "%s" at the location "%s".  Please use describe(\'%s\').';
    return Rule;
}(Lint.Rules.AbstractRule));
exports.Rule = Rule;
function getSearchResults(searchName, searchDirectory) {
    return glob.sync('**/' + searchName, {
        ignore: [
            '**/node_modules/**',
            '**/packages/**',
            '**/vendor/**',
            '/Users/**/Downloads/**',
            '/Users/**/Library/**',
            '/Users/**/Applications/**',
            '/Users/**/Music/**',
            '**/wp-content/**',
            '**/wp-includes/**',
            '**/Pods/**',
            '**/svn/**',
            '**/.git/**',
            '**/.vscode/**',
            '**/.npm/**',
            '**/\\.*',
            '**/Cache/**',
            '**/Creative Cloud Files/**'
        ],
        cwd: path.resolve(searchDirectory),
        silent: true,
        nodir: true,
        strict: false
    });
}
function searchForSpec(filename) {
    var searchDirectory = path.dirname(filename);
    var searchName = path.basename(filename)
        .replace(/\.ts$/ig, '.spec.ts');
    var results = getSearchResults(searchName, searchDirectory);
    if (results.length == 0) {
        searchDirectory = path.dirname(searchDirectory);
        searchName = searchName
            .replace(/\.ts$/ig, '**.spec.ts')
            .replace('/\.component|\.service/ig', '');
        results = getSearchResults(searchName, searchDirectory);
    }
    if (results.length === 0) {
        return void 0;
    }
    return path.join(searchDirectory, results[0]);
}
var ComponentSpecSearcher = (function (_super) {
    __extends(ComponentSpecSearcher, _super);
    function ComponentSpecSearcher(sourceFile, rule) {
        var _this = _super.call(this, sourceFile, rule.getOptions()) || this;
        _this.rule = rule;
        _this.isInjectable = false;
        return _this;
    }
    ComponentSpecSearcher.prototype.visitMethodDeclaration = function (node) {
        var location = this.getSourceFile().fileName;
        if (location.indexOf('testing') > -1 || location.indexOf('.spec.ts') > -1) {
            return;
        }
        var isPublic = !node.modifiers || !node.modifiers
            .some(function (m) { return m.kind
            === SyntaxKind.current().PrivateKeyword
            || m.kind
                === SyntaxKind.current().ProtectedKeyword; });
        if (typeof this.className == 'undefined') {
            this.checkClassSpec(node.parent, location);
        }
        if (isPublic) {
            var specMethodDescription = this.className + '.' + node.name.getText();
            if (typeof this.specText === 'undefined' || this.specText.indexOf(specMethodDescription) == -1) {
                var failureConfig = [
                    this.className,
                    node.name.getText(),
                    this.foundSpec,
                    specMethodDescription
                ];
                failureConfig.unshift(Rule.SPEC_METHOD_FAILURE_STRING);
                this.generateFailure(node.pos, node.end, failureConfig);
            }
        }
    };
    ComponentSpecSearcher.prototype.checkClassSpec = function (node, location) {
        this.className = node.name.text;
        var decorators = node.decorators || [];
        var pipes = decorators.map(function (d) {
            return d.expression.text ||
                (d.expression.expression || {}).text;
        });
        if (pipes.filter(function (p) { return p === 'Injectable' || p === 'Component'; }).length === 0) {
            return;
        }
        this.foundSpec = searchForSpec(location);
        if (typeof this.foundSpec === 'undefined') {
            var failureConfig = [this.className, location.replace('.ts', '.spec.ts')];
            failureConfig.unshift(Rule.SPEC_FAILURE_STRING);
            this.generateFailure(node.pos, node.end, failureConfig);
        }
        else {
            this.specText = fs.readFileSync(this.foundSpec).toString('UTF-8');
        }
    };
    ComponentSpecSearcher.prototype.generateFailure = function (start, width, failureConfig) {
        this.addFailureAt(start, width, sprintf_js_1.sprintf.apply(this, failureConfig));
    };
    return ComponentSpecSearcher;
}(ngWalker_1.NgWalker));
exports.ComponentSpecSearcher = ComponentSpecSearcher;
