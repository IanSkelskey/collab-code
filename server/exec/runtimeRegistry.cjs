const { javaRunner } = require('./runtimes/java.cjs');
const { pythonRunner } = require('./runtimes/python.cjs');

const runners = [javaRunner, pythonRunner];
const runnersByLanguage = new Map(runners.map((runner) => [runner.language, runner]));

function getRunner(language) {
  return runnersByLanguage.get(language) ?? null;
}

function resolveExecutionLanguage(message, files) {
  if (message.language && runnersByLanguage.has(message.language)) {
    return message.language;
  }

  if (message.mainClass) {
    return 'java';
  }

  for (const runner of runners) {
    if (runner.canHandle({ message, files })) {
      return runner.language;
    }
  }

  return null;
}

function getCapabilities() {
  return runners.map((runner) => ({
    language: runner.language,
    available: typeof runner.isAvailable === 'function' ? runner.isAvailable() : false,
    version: typeof runner.getVersion === 'function' ? runner.getVersion() : null,
    canRun: typeof runner.start === 'function',
    canCheck: typeof runner.check === 'function',
  }));
}

module.exports = {
  getRunner,
  resolveExecutionLanguage,
  getCapabilities,
};
