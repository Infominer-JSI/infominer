import qm from "qminer";
import {
    EAggregateType,
    IBaseDatasetField,
    IDocumentRecordSet,
    IHierarchyObject,
    IProcessing,
} from "../../../interfaces";

/**
 * Calculates the statistics of the subset and creates a new method.
 * @param base - The qminer base.
 * @param subsetId - The subset ID.
 * @param fields - The base fields metadata.
 */
export function getAggregates(
    documents: IDocumentRecordSet,
    fields: IBaseDatasetField[],
    params: IProcessing
) {
    // calculates the aggregates
    const aggregates = fields
        .map((field) =>
            field.aggregate
                ? {
                      field: field.name,
                      type: field.aggregate,
                      statistics: _aggregatesByField(documents, field, params),
                  }
                : null
        )
        .filter((v) => v);
    return aggregates;
}

/** Creates a copy of an object. */
export function copy(obj: any) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Calculates the subset field statistics.
 * @param base - The QMiner base.
 * @param elements - The subset record.
 * @param field - The field metadata.
 */
function _aggregatesByField(elements: qm.RecordSet, field: IBaseDatasetField, params: IProcessing) {
    // get the field metadata
    const { name: fieldName, aggregate } = field;
    // calculate the aggregates
    let statistics: { [key: string]: any } = {};
    if (aggregate === EAggregateType.HIERARCHY) {
        // generate the hierarchy structure
        const children: IHierarchyObject[] = [];
        elements.each((rec) => {
            let fieldVals: string[] | null = rec[fieldName]?.toArray();
            if (fieldVals) {
                fieldVals = fieldVals.filter((val) => val !== "");
                if (fieldVals.length > 0) {
                    createHierarchy(children, fieldVals[0], fieldVals.slice(1));
                }
            }
        });
        // update the hierarchy statistics
        updateHierarchyPercentage(children, elements.length);
        // define the final statistics
        statistics = {
            type: "hierarchy",
            values: {
                name: "root",
                frequency: elements.length,
                precent: 100,
                children,
            },
        };
    } else if (aggregate === EAggregateType.KEYWORDS) {
        statistics = elements.aggr({
            name: aggregate,
            field: fieldName,
            type: EAggregateType.KEYWORDS,
            sample: elements.length,
            stopwords: params.stopwords,
        });
        if (statistics && statistics.keywords && !statistics.keywords.length) {
            statistics.keywords.push({ keyword: (elements[0] as qm.Record)[fieldName], weight: 1 });
        }
        // normalize the statistics values
        statistics.values = copy(statistics.keywords);
        delete statistics.keywords;
    } else if (aggregate === EAggregateType.HISTOGRAM) {
        // get the histogram statistics
        statistics = {
            type: aggregate,
            count: elements.length,
            max: 0,
            mean: 0,
            median: 0,
            min: 0,
            stdev: 0,
            sum: 0,
            values: [],
            // override with the actual values
            ...(elements.getVector(fieldName).sum() > 0 &&
                elements.aggr({
                    name: aggregate,
                    field: fieldName,
                    type: EAggregateType.HISTOGRAM,
                })),
        };
    } else if (aggregate === EAggregateType.COUNT) {
        // get the count statistics
        statistics = elements.aggr({
            name: aggregate,
            field: fieldName,
            type: EAggregateType.COUNT,
        });
    } else if (aggregate === EAggregateType.TIMELINE) {
        // get the timeline statistics
        statistics = elements.aggr({
            name: aggregate,
            field: fieldName,
            type: EAggregateType.TIMELINE,
        });
    }
    // delete non-useful fields
    delete statistics.type;
    delete statistics.field;
    delete statistics.join;
    // return the statistics
    return statistics;
}
/**
 * Creates the hierarchy.
 * @param hierarchy - The hierarchy container.
 * @param current - The current value.
 * @param next - The array of next values.
 */
function createHierarchy(hierarchy: IHierarchyObject[], current: string, next: string[]) {
    let object;
    for (const child of hierarchy) {
        if (child.name === current) {
            child.frequency += 1;
            object = child;
            break;
        }
    }
    if (!object) {
        const length = hierarchy.push({
            name: current,
            frequency: 1,
            precent: 0,
            children: [],
        });
        object = hierarchy[length - 1];
    }

    if (next.length > 0) {
        // continue down the hierarchy
        createHierarchy(object.children as IHierarchyObject[], next[0], next.slice(1));
    }
}

/**
 * Updates the hierarchy precent values.
 * @param hierarchy - The hierarchy container.
 * @param nElements - The number of elements.
 */
function updateHierarchyPercentage(hierarchy: IHierarchyObject[], nElements: number) {
    for (const hier of hierarchy) {
        // get the percentage rate
        hier.precent = hier.frequency / nElements;
        if (hier.children && hier.children.length > 0) {
            // iterate through its children
            updateHierarchyPercentage(hier.children, nElements);
        } else {
            delete hier.children;
        }
    }
}
