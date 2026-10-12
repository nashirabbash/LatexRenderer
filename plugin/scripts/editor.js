export function callEditor(command) {
  return new Promise((resolve, reject) => {
    try {
      window.Asc.plugin.callCommand(command, false, true, resolve);
    } catch (error) {
      reject(error);
    }
  });
}
