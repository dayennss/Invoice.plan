import aws_cdk as cdk
from aws_cdk import aws_dynamodb as dynamodb, aws_s3 as s3
from constructs import Construct


class StorageStack(cdk.Stack):
    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        self.table = dynamodb.Table(
            self, "InvoicePlanTable",
            table_name="invoice-plan",
            partition_key=dynamodb.Attribute(name="PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="SK", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=cdk.RemovalPolicy.RETAIN,
        )

        # GSI: busca por mês (queries do dashboard)
        self.table.add_global_secondary_index(
            index_name="GSI_YearMonth",
            partition_key=dynamodb.Attribute(name="PK", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="year_month", type=dynamodb.AttributeType.STRING),
        )

        # Bucket temporário para PDFs em processamento async.
        # Lifecycle rule apaga órfãos > 1 dia (garbage collection se worker falhar).
        self.pending_pdfs_bucket = s3.Bucket(
            self, "PendingPdfsBucket",
            bucket_name=f"invoice-plan-pdfs-pending-{cdk.Aws.ACCOUNT_ID}",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=cdk.RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            lifecycle_rules=[
                s3.LifecycleRule(
                    id="delete-orphans",
                    expiration=cdk.Duration.days(1),
                ),
            ],
        )
