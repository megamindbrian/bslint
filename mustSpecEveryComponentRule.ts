import * as Lint from 'tslint';
import * as ts from 'typescript';
import { sprintf } from 'sprintf-js';
import { NgWalker } from 'codelyzer/angular/ngWalker';
import * as path from 'path';
import * as glob from 'glob';
import * as SyntaxKind from 'codelyzer/util/syntaxKind';
import * as fs from 'fs';

export class Rule extends Lint.Rules.AbstractRule {
    public static metadata: Lint.IRuleMetadata = {
        ruleName: 'must-spec-every-component',
        type: 'maintainability',
        description: `Ensure that classes all classes have spec files.`,
        options: null,
        optionsDescription: `Not configurable.`,
        typescriptOnly: true,
    };

    static SPEC_FAILURE_STRING: string = 'In the class "%s", there is a missing'
        + ' spec file at the location "%s".  Please create it.';

    static SPEC_METHOD_FAILURE_STRING: string = 'In the class "%s", there is a missing'
        + ' spec description for the method "%s" at the location "%s".  Please use describe(\'%s\').';

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ComponentSpecSearcher(sourceFile, this));
    }
}

function getSearchResults(searchName: string, searchDirectory: string) {
    // search for a spec using glob.sync()
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

function searchForSpec(filename: string): string {

    // search one level up from current component
    let searchDirectory = path.dirname(filename);

    // parse off the .ts and .component naming conventions
    let searchName = path.basename(filename)
        .replace(/\.ts$/ig, '.spec.ts');

    let results = getSearchResults(searchName, searchDirectory);
    if (results.length == 0) {
        searchDirectory = path.dirname(searchDirectory);
        searchName = searchName
            .replace(/\.ts$/ig, '**.spec.ts')
            .replace('/\.component|\.service/ig', '');
        results = getSearchResults(searchName, searchDirectory);
    }

    // TODO: recommend naming changes?
    if (results.length === 0) {
        return void 0;
    }
    return path.join(searchDirectory, results[0]);
}

export class ComponentSpecSearcher extends NgWalker {

    className: string;
    isInjectable = false;
    foundSpec: string;
    specText: string;

    constructor(sourceFile: ts.SourceFile, private rule: Rule) {
        super(sourceFile, rule.getOptions());
    }

    visitMethodDeclaration(node: ts.MethodDeclaration): void {

        // don't run this rule on test files
        const location = this.getSourceFile().fileName;
        // TODO: make this a configurable option (exclude test)
        if (location.indexOf('testing') > -1 || location.indexOf('.spec.ts') > -1) {
            return;
        }

        let isPublic = !node.modifiers || !node.modifiers
            .some(m => m.kind
                === SyntaxKind.current().PrivateKeyword
                || m.kind
                === SyntaxKind.current().ProtectedKeyword);

        if (typeof this.className == 'undefined') {
            this.checkClassSpec(node.parent as ts.ClassDeclaration, location);
        }

        if (isPublic) {
            const specMethodDescription = this.className + '.' + node.name.getText();
            // TODO: double check the class declaration is a valid name in the describe block

            // check if spec file has describe block for each method
            if (typeof this.specText === 'undefined' || this.specText.indexOf(specMethodDescription) == -1) {
                let failureConfig: string[] = [
                    this.className,
                    node.name.getText(),
                    this.foundSpec,
                    specMethodDescription
                ];
                failureConfig.unshift(Rule.SPEC_METHOD_FAILURE_STRING);
                this.generateFailure(node.pos, node.end, failureConfig);
            }
        }
    }

    private checkClassSpec(node: ts.ClassDeclaration, location: string) {
        this.className = node.name.text;

        // check if we need a spec on this class using the Injectable or Component decorators
        let decorators = <any[]>node.decorators || [];
        let pipes: Array<string> = decorators.map(d =>
            (<any>d.expression).text ||
            ((<any>d.expression).expression || {}).text);

        if (pipes.filter(p => p === 'Injectable' || p === 'Component').length === 0) {
            return;
        }

        // TODO: search for spec files matching naming conventions
        this.foundSpec = searchForSpec(location);
        if (typeof this.foundSpec === 'undefined') {
            // make sure we aren't already in a testing folder with stubs
            let failureConfig: string[] = [this.className, location.replace('.ts', '.spec.ts')];
            failureConfig.unshift(Rule.SPEC_FAILURE_STRING);
            this.generateFailure(node.pos, node.end, failureConfig);
        } else {
            this.specText = fs.readFileSync(this.foundSpec).toString('UTF-8');
        }
    }

    private generateFailure(start: number, width: number, failureConfig: string[]) {
        this.addFailureAt(
            start,
            width,
            sprintf.apply(this, failureConfig));
    }
}


