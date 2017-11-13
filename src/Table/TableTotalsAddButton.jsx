import React from 'react';
import cx from 'classnames';

const { Component, PropTypes } = React;

export default class TableTotalsAddButton extends Component {
    static propTypes = {
        onClick: PropTypes.func,
        onMouseEnter: PropTypes.func,
        onMouseLeave: PropTypes.func,
        hidden: PropTypes.bool
    };

    static defaultProps = {
        onClick: () => {},
        onMouseEnter: () => {},
        onMouseLeave: () => {},
        hidden: false
    };

    render() {
        const className = cx({
            hidden: this.props.hidden
        }, 's-total-add-row', 'indigo-totals-add-row-button', 'icon-circle-plus');

        return (
            <div
                className={className}
                onClick={this.props.onClick}
                onMouseEnter={this.props.onMouseEnter}
                onMouseLeave={this.props.onMouseLeave}
            />
        );
    }
}
