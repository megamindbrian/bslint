import * as Lint from 'tslint';
import * as ts from 'typescript';
import { sprintf } from 'sprintf-js';
import { NgWalker } from 'codelyzer/angular/ngWalker';

export class Rule extends Lint.Rules.AbstractRule {
    public static metadata: Lint.IRuleMetadata = {
        ruleName: 'must-spec-every-component',
        type: 'functionality',
        description: `Ensure that classes all classes have spec files.`,
        options: null,
        optionsDescription: `Not configurable.`,
        typescriptOnly: true,
    };


    static INJECTABLE_FAILURE_STRING: string = 'In the class "%s" which have the "%s" decorator, there is a missing'
        + ' spec file at the location "%s".  Please create it.';

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ClassMetadataWalker(sourceFile, this));
    }
}


export class ClassMetadataWalker extends NgWalker {

    className: string;
    isInjectable = false;

    constructor(sourceFile: ts.SourceFile, private rule: Rule) {
        super(sourceFile, rule.getOptions());
    }

    visitNgInjectable(classDeclaration: ts.ClassDeclaration, decorator: ts.Decorator) {
        this.className = classDeclaration.name.text;
        this.isInjectable = true;
        // TODO: check if there is a spec file in the project with this files class name in it
        let failureConfig: string[] = [this.className, '@Injectable', '@Input', this.getSourceFile().fileName];
        failureConfig.unshift(Rule.INJECTABLE_FAILURE_STRING);
        this.generateFailure(decorator.pos, decorator.end, failureConfig);
    }

    private generateFailure(start: number, width: number, failureConfig: string[]) {
        this.addFailureAt(
            start,
            width,
            sprintf.apply(this, failureConfig));
    }

}


