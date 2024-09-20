// Create and append the console element to the body
const consoleElement = document.createElement('div');
consoleElement.innerHTML = `
  <div style="border: 1px solid #ccc; border-radius: 4px; padding: 16px; background-color: #f8f8f8; width: 100%; max-width: 600px; margin: 20px auto;">
    <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Console Output</h2>
    <div id="console-output" style="background-color: black; color: white; padding: 8px; border-radius: 4px; height: 200px; overflow-y: auto; font-family: monospace; font-size: 14px;"></div>
  </div>
`;
document.body.appendChild(consoleElement);

const consoleOutput = document.getElementById('console-output');

// Function to add log to the console
function addLog(message, type = 'log') {
  const logElement = document.createElement('div');
  logElement.style.marginBottom = '4px';
  logElement.style.color = type === 'error' ? '#ff6b6b' : '#69db7c';
  logElement.textContent = message;
  consoleOutput.appendChild(logElement);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// Override console.log and console.error
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  addLog(args.join(' '), 'log');
  originalLog.apply(console, args);
};

console.error = function(...args) {
  addLog(args.join(' '), 'error');
  originalError.apply(console, args);
};

addEventListener("error",(...args)=>{
     console.error(...args); 
});
addEventListener("unhandledrejection", function(promiseRejectionEvent) {
    console.error(promiseRejectionEvent.reason.stack);
});
