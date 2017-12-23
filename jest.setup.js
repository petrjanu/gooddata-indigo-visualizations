import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-15';

Enzyme.configure({ adapter: new Adapter() });

// Fail test on console error (react proptypes validation etc.)
const consoleError = console.error; // eslint-disable-line no-console
console.error = (err, ...args) => { // eslint-disable-line no-console
    consoleError(err, ...args);
    throw new Error(err);
};
