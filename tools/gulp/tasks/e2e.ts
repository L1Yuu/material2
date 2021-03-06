import {task} from 'gulp';
import {join} from 'path';
import {ngcBuildTask, copyTask, execNodeTask, serverTask} from '../util/task_helpers';
import {copySync} from 'fs-extra';
import {buildConfig, sequenceTask, triggerLivereload, watchFiles} from 'material2-build-tools';

// There are no type definitions available for these imports.
const gulpConnect = require('gulp-connect');

const {outputDir, packagesDir, projectDir} = buildConfig;

/** Path to the directory where all releases are created. */
const releasesDir = join(outputDir, 'releases');

const appDir = join(packagesDir, 'e2e-app');
const e2eTestDir = join(projectDir, 'e2e');
const outDir = join(outputDir, 'packages', 'e2e-app');

const PROTRACTOR_CONFIG_PATH = join(projectDir, 'test/protractor.conf.js');
const tsconfigPath = join(outDir, 'tsconfig-build.json');

/** Glob that matches all files that need to be copied to the output folder. */
const assetsGlob = join(appDir, '**/*.+(html|css|json|ts)');

/** Builds and serves the e2e-app and runs protractor once the e2e-app is ready. */
task('e2e', sequenceTask(
  [':test:protractor:setup', 'serve:e2eapp'],
  ':test:protractor',
  ':serve:e2eapp:stop',
  'screenshots',
));

/**
 * Builds and serves the e2e-app and runs protractor when the app is ready. Re-runs protractor when
 * the app or tests change.
 */
task('e2e:watch', sequenceTask(
  [':test:protractor:setup', 'serve:e2eapp'],
  [':test:protractor', 'material:watch', ':e2e:watch'],
));

/** Watches the e2e app and tests for changes and triggers a test rerun on change. */
task(':e2e:watch', () => {
  watchFiles([join(appDir, '**/*.+(html|ts|css)'), join(e2eTestDir, '**/*.+(html|ts)')],
      [':e2e:rerun'], false);
});

/** Updates the e2e app and runs the protractor tests. */
task(':e2e:rerun', sequenceTask(
  'e2e-app:copy-assets',
  'e2e-app:build-ts',
  ':e2e:reload',
  ':test:protractor'
));

/** Triggers a reload of the e2e app. */
task(':e2e:reload', () => {
  return triggerLivereload();
});

/** Task that builds the e2e-app in AOT mode. */
task('e2e-app:build', sequenceTask(
  'clean',
  [
    'cdk:build-release',
    'material:build-release',
    'cdk-experimental:build-release',
    'material-experimental:build-release',
    'material-moment-adapter:build-release',
    'material-examples:build-release'
  ],
  ['e2e-app:copy-release', 'e2e-app:copy-assets'],
  'e2e-app:build-ts'
));

/** Task that copies all required assets to the output folder. */
task('e2e-app:copy-assets', copyTask(assetsGlob, outDir));

/** Task that builds the TypeScript sources. Those are compiled inside of the dist folder. */
task('e2e-app:build-ts', ngcBuildTask(tsconfigPath));

task(':watch:e2eapp', () => {
  watchFiles(join(appDir, '**/*.ts'), ['e2e-app:build'], false);
  watchFiles(join(appDir, '**/*.html'), ['e2e-app:copy-assets'], false);
});

/** Ensures that protractor and webdriver are set up to run. */
task(':test:protractor:setup', execNodeTask('protractor', 'webdriver-manager', ['update']));

/** Runs protractor tests (assumes that server is already running. */
task(':test:protractor', execNodeTask('protractor', [PROTRACTOR_CONFIG_PATH]));

/** Starts up the e2e app server. */
task(':serve:e2eapp', serverTask(outDir, false));

/** Terminates the e2e app server */
task(':serve:e2eapp:stop', gulpConnect.serverClose);

/** Builds and serves the e2e app. */
task('serve:e2eapp', sequenceTask('e2e-app:build', ':serve:e2eapp'));

/**
 * [Watch task] Builds and serves e2e app, rebuilding whenever the sources change.
 * This should only be used when running e2e tests locally.
 */
task('serve:e2eapp:watch', ['serve:e2eapp', 'material:watch', ':watch:e2eapp']);

// As a workaround for https://github.com/angular/angular/issues/12249, we need to
// copy the Material and CDK ESM output inside of the demo-app output.
task('e2e-app:copy-release', () => {
  copySync(join(releasesDir, 'cdk'), join(outDir, 'cdk'));
  copySync(join(releasesDir, 'material'), join(outDir, 'material'));
  copySync(join(releasesDir, 'cdk-experimental'), join(outDir, 'cdk-experimental'));
  copySync(join(releasesDir, 'material-experimental'), join(outDir, 'material-experimental'));
  copySync(join(releasesDir, 'material-examples'), join(outDir, 'material-examples'));
  copySync(join(releasesDir, 'material-moment-adapter'), join(outDir, 'material-moment-adapter'));
});

