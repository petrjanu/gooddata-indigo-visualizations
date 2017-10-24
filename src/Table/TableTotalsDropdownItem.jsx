import React, { Component, PropTypes } from 'react';
import { injectIntl, FormattedMessage } from 'react-intl';
import cx from 'classnames';

export class TableTotalsDropdownItem extends Component {
    static propTypes = {
        intl: PropTypes.object.isRequired,
        item: PropTypes.object.isRequired,
        onSelect: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);

        this.onSelect = this.onSelect.bind(this);
    }

    onSelect() {
        const { item, onSelect } = this.props;
        onSelect(item);
    }

    render() {
        const { item } = this.props;

        if (item.role === 'header') {
            return (
                <div className="gd-list-item gd-list-item-header indigo-totals-select-type-header">
                    <FormattedMessage id={item.title} />
                </div>
            );
        }

        const classNames = cx(
            'gd-list-item',
            'gd-list-item-shortened',
            `s-totals-select-type-item-${item.type}`,
            {
                'indigo-totals-select-type-item-disabled': item.disabled
            }
        );

        const onClick = item.disabled ? () => {} : this.onSelect;

        return (
            <div className={classNames} onClick={onClick}>
                {item.title}
            </div>
        );
    }
}

export default injectIntl(TableTotalsDropdownItem);
