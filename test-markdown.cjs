const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Markdown = require('react-markdown').default || require('react-markdown');

function Test() {
  return React.createElement(Markdown, {
    components: {
      ul: ({node, ...props}) => React.createElement('ul', { className: "[&>li]:bg-white" }, props.children),
      li: ({node, ...props}) => React.createElement('li', { className: "mb-2" }, props.children)
    }
  }, '* A\n* B\n\n1. C\n2. D');
}
console.log(renderToStaticMarkup(React.createElement(Test)));
