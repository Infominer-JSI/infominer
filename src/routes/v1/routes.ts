// import modules
import express, { Request, Response, NextFunction } from "express";
import { param, validationResult } from "express-validator";

// import utils
import { BadRequest } from "../../utils/ErrorDefs";

// import middleware
import uploadFile from "../../middleware/fileUpload";
import * as validators from "../../middleware/validators";

// import controllers
import * as controllers from "../../controllers/v1/controllers";

// initialize the router
const router = express.Router();

// //////////////////////////////////////////////
// Route validations
// //////////////////////////////////////////////

// validate the request parameters
const validateRequest = (req: Request, _res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(errors.array());
        // create the error message
        const message = errors
            .array()
            .map((error) => `${error.msg}; ${error.param}=${error.value}`)
            .join(", ");
        // send the bad request error
        return next(new BadRequest(message));
    }
    return next();
};

// define how and which routes should be validated
const validationDefs = [
    {
        routes: ["/datasets/:datasetId", "/datasets/:datasetId/*"],
        params: [param("datasetId").isInt()],
    },
    {
        routes: [
            "/datasets/:datasetId/methods/:methodId",
            "/datasets/:datasetId/methods/:methodId/*",
        ],
        params: [param("methodId").isInt()],
    },
    {
        routes: [
            "/datasets/:datasetId/subsets/:subsetId",
            "/datasets/:datasetId/subsets/:subsetId/*",
        ],
        params: [param("subsetId").isInt()],
    },
    {
        routes: [
            "/datasets/:datasetId/subsets/:subsetId/documents/:documentId",
            "/datasets/:datasetId/subsets/:subsetId/documents/:documentId/*",
        ],
        params: [param("documentId").isInt()],
    },
];

for (const { routes, params } of validationDefs) {
    router.all(routes, params, validateRequest);
}

// //////////////////////////////////////////////
// Route definitions
// //////////////////////////////////////////////

const routeDefs = [
    // //////////////////////////////////////////////
    // Dataset routes
    // //////////////////////////////////////////////
    { method: "GET", route: "/datasets", middleware: [], controller: controllers.getDatasets },
    // POST and upload a dataset file to retrieve metadata
    {
        method: "POST",
        route: "/datasets",
        middleware: [uploadFile],
        controller: controllers.uploadDataset,
    },
    // POST the dataset metadata for dataset creation
    {
        method: "POST",
        route: "/datasets/:datasetId",
        middleware: validators.datasets,
        controller: controllers.createDataset,
    },
    {
        method: "GET",
        route: "/datasets/:datasetId/status",
        middleware: validators.datasets,
        controller: controllers.checkDatasetStatus,
    },
    {
        method: "GET",
        route: "/datasets/:datasetId",
        middleware: validators.datasets,
        controller: controllers.getDataset,
    },
    {
        method: "PUT",
        route: "/datasets/:datasetId",
        middleware: validators.datasets,
        controller: controllers.updateDataset,
    },
    {
        method: "DELETE",
        route: "/datasets/:datasetId",
        middleware: validators.datasets,
        controller: controllers.deleteDataset,
    },
    // //////////////////////////////////////////////
    // Methods routes
    // //////////////////////////////////////////////
    {
        method: "GET",
        route: "/datasets/:datasetId/methods",
        middleware: validators.datasets,
        controller: controllers.getMethods,
    },
    {
        method: "POST",
        route: "/datasets/:datasetId/methods",
        middleware: validators.datasets,
        controller: controllers.createMethod,
    },
    {
        method: "GET",
        route: "/datasets/:datasetId/methods/:methodId",
        middleware: validators.methods,
        controller: controllers.getMethod,
    },
    {
        method: "PUT",
        route: "/datasets/:datasetId/methods/:methodId",
        middleware: validators.methods,
        controller: controllers.updateMethod,
    },
    {
        method: "DELETE",
        route: "/datasets/:datasetId/methods/:methodId",
        middleware: validators.methods,
        controller: controllers.deleteMethod,
    },
    // //////////////////////////////////////////////
    // Subsets routes
    // //////////////////////////////////////////////
    {
        method: "GET",
        route: "/datasets/:datasetId/subsets",
        middleware: validators.datasets,
        controller: controllers.getSubsets,
    },
    {
        method: "POST",
        route: "/datasets/:datasetId/subsets",
        middleware: validators.datasets,
        controller: controllers.createSubset,
    },
    {
        method: "GET",
        route: "/datasets/:datasetId/subsets/:subsetId",
        middleware: validators.subsets,
        controller: controllers.getSubset,
    },
    {
        method: "PUT",
        route: "/datasets/:datasetId/subsets/:subsetId",
        middleware: validators.subsets,
        controller: controllers.updateSubset,
    },
    {
        method: "DELETE",
        route: "/datasets/:datasetId/subsets/:subsetId",
        middleware: validators.subsets,
        controller: controllers.deleteSubset,
    },
    {
        method: "GET",
        route: "/datasets/:datasetId/subsets/:subsetId/download",
        middleware: validators.subsets,
        controller: controllers.downloadSubset,
    },
    // //////////////////////////////////////////////
    // Documents routes
    // //////////////////////////////////////////////
    {
        method: "GET",
        route: "/datasets/:datasetId/documents",
        middleware: validators.datasets.concat(validators.documentsQuery),
        controller: controllers.getDocuments,
    },
    {
        method: "GET",
        route: "/datasets/:datasetId/documents/:documentId",
        middleware: validators.documents,
        controller: controllers.getDocument,
    },
    {
        method: "PUT",
        route: "/datasets/:datasetId/documents/:documentId",
        middleware: validators.documents,
        controller: controllers.updateDocument,
    },
];

// configure the router with the definitions
for (const { method, route, middleware, controller } of routeDefs) {
    switch (method) {
        case "GET":
            router.get(route, middleware, controller);
            break;
        case "POST":
            router.post(route, middleware, controller);
            break;
        case "PUT":
            router.put(route, middleware, controller);
            break;
        case "DELETE":
            router.delete(route, middleware, controller);
            break;
        default:
            throw new Error(`Unknown route method: ${method}`);
    }
}

export default router;
