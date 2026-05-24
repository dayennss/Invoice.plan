#!/usr/bin/env python3
import aws_cdk as cdk
from stacks.api_stack import ApiStack
from stacks.storage_stack import StorageStack
from stacks.frontend_stack import FrontendStack

app = cdk.App()

env = cdk.Environment(
    account=app.node.try_get_context("account"),
    region="sa-east-1",
)

storage = StorageStack(app, "InvoicePlanStorage", env=env)
api = ApiStack(app, "InvoicePlanApi", table=storage.table, env=env)
FrontendStack(app, "InvoicePlanFrontend", env=env)

app.synth()
