import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

export default class AddTotalButton extends PureComponent {
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
        }, 's-total-add-row', 'indigo-totals-add-row-button');

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
