export function getTotalsTypesList() {
    return [
        'sum',
        'avg',
        'min',
        'max',
        'nat',
        'med'
    ];
}

function getTotalsList(intl) {
    const types = getTotalsTypesList();

    return types.map(type => ({
        type,
        title: intl.formatMessage({ id: `visualizations.totals.funcTitle.${type}` }),
        alias: intl.formatMessage({ id: `visualizations.totals.funcAlias.${type}` })
    }));
}

export function getTotalsDatasource(usedTotals, intl) {
    const usedTotalsTypes = usedTotals.map(total => total.type);

    const list = getTotalsList(intl).map(total => ({
        ...total,
        disabled: usedTotalsTypes.includes(total.type)
    }));

    list.unshift({ title: 'visualizations.totals.dropdownHeading', role: 'header' });

    return {
        rowsCount: list.length,
        getObjectAt: index => list[index]
    };
}

export function getTotalFromListByType(totalItemType, intl) {
    const { alias, type } = getTotalsList(intl).find(total => total.type === totalItemType);

    return { alias, type };
}

export function getOrderedTotalsWithMockedData(usedTotals) {
    if (!usedTotals.length) {
        return [];
    }

    const mockData = [
        [null, 1279876.1234894, 123.123, null, 256, 815, 99, 9876983, null, 9845],
        [null, 45894267842.1239, 45.98, 12.32, null, 12, 113, 231, 45, 112.32],
        [null, 12.99, 0.012, 189415616.28, 12.0001, 1.008, 2, 2.098765, 0.1, 10.0987]
    ];

    const types = getTotalsTypesList();

    return types.reduce((totals, type, index) => {
        const usedTotal = usedTotals.find(total => total.type === type);

        if (usedTotal) {
            totals.push({
                ...usedTotal,
                values: mockData[index % 3]
            });
        }

        return totals;
    }, []);
}

export function addTotalMeasureIndexes(totals) {
    return totals.map(total => ({
        ...total,
        outputMeasureIndexes: [] // FIXME: only for validation purposes on backend, will be used in upcoming story
    }));
}

export function toggleCellClass(parentReference, state, columnIndex, className) {
    const cells = parentReference.querySelectorAll(`.col-${columnIndex}`);

    cells.forEach((cell) => {
        if (state) {
            cell.classList.add(className);
        } else {
            cell.classList.remove(className);
        }
    });
}

export function resetRowClass(parentReference, className, rowIndexToBeSet = null) {
    const rows = parentReference.querySelectorAll('.indigo-totals-remove > .indigo-totals-remove-row');

    rows.forEach(r => r.classList.remove(className));

    if (rowIndexToBeSet !== null) {
        const row = rows[rowIndexToBeSet];
        row.classList.add(className);
    }
}

export function isAddingMoreTotalsEnabled(addedTotals) {
    return addedTotals.length < getTotalsTypesList().length;
}
