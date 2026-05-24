import aws_cdk as cdk
from aws_cdk import (
    aws_lambda as lambda_,
    aws_apigatewayv2 as apigwv2,
    aws_apigatewayv2_integrations as integrations,
    aws_dynamodb as dynamodb,
)
from constructs import Construct
import os


class ApiStack(cdk.Stack):
    def __init__(self, scope: Construct, id: str, table: dynamodb.Table, **kwargs):
        super().__init__(scope, id, **kwargs)

        shared_layer = lambda_.LayerVersion(
            self, "SharedLayer",
            code=lambda_.Code.from_asset("../backend"),
            compatible_runtimes=[lambda_.Runtime.PYTHON_3_12],
            description="invoice.plan shared modules",
        )

        common_env = {
            "DYNAMODB_TABLE": table.table_name,
            "AI_PROVIDER": "gemini",
            "AWS_REGION": "sa-east-1",
        }

        invoices_fn = lambda_.Function(
            self, "InvoicesFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="handler.lambda_handler",
            code=lambda_.Code.from_asset("../backend/functions/invoices"),
            layers=[shared_layer],
            environment=common_env,
            timeout=cdk.Duration.seconds(60),
            memory_size=512,
        )

        dashboard_fn = lambda_.Function(
            self, "DashboardFunction",
            runtime=lambda_.Runtime.PYTHON_3_12,
            handler="handler.lambda_handler",
            code=lambda_.Code.from_asset("../backend/functions/dashboard"),
            layers=[shared_layer],
            environment=common_env,
            timeout=cdk.Duration.seconds(15),
            memory_size=256,
        )

        table.grant_read_write_data(invoices_fn)
        table.grant_read_data(dashboard_fn)

        http_api = apigwv2.HttpApi(
            self, "HttpApi",
            api_name="invoice-plan-api",
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_headers=["Content-Type", "Authorization"],
                allow_methods=[apigwv2.CorsHttpMethod.ANY],
                allow_origins=["*"],
            ),
        )

        http_api.add_routes(
            path="/invoices",
            methods=[apigwv2.HttpMethod.POST],
            integration=integrations.HttpLambdaIntegration("InvoicesIntegration", invoices_fn),
        )
        http_api.add_routes(
            path="/dashboard/{yearMonth}",
            methods=[apigwv2.HttpMethod.GET],
            integration=integrations.HttpLambdaIntegration("DashboardIntegration", dashboard_fn),
        )

        cdk.CfnOutput(self, "ApiUrl", value=http_api.url or "")
