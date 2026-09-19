"""Unit test verifying that the Lambda handler properly wraps FastAPI via Mangum.

Simulates AWS API Gateway HTTP API v2 payload events and tests response serialization.
"""

from __future__ import annotations

import json

from lambda_handler import lambda_handler


class MockLambdaContext:
    function_name = "FlowForgeApiFunction"
    memory_limit_in_mb = 1024
    invoked_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:FlowForgeApiFunction"
    aws_request_id = "test-request-id-12345"


def test_lambda_handler_handles_health_check_event():
    event = {
        "version": "2.0",
        "routeKey": "GET /health",
        "rawPath": "/health",
        "rawQueryString": "",
        "headers": {
            "accept": "*/*",
            "host": "api.example.com",
            "x-forwarded-for": "127.0.0.1",
        },
        "requestContext": {
            "http": {
                "method": "GET",
                "path": "/health",
                "protocol": "HTTP/1.1",
                "sourceIp": "127.0.0.1",
                "userAgent": "pytest",
            }
        },
        "isBase64Encoded": False,
    }

    response = lambda_handler(event, MockLambdaContext())
    assert response["statusCode"] == 200
    assert "content-type" in response["headers"]
    body = json.loads(response["body"])
    assert body["status"] == "healthy"
    assert body["app"] == "FlowForge"


def test_lambda_handler_handles_not_found_route():
    event = {
        "version": "2.0",
        "routeKey": "GET /non-existent-endpoint",
        "rawPath": "/non-existent-endpoint",
        "rawQueryString": "",
        "headers": {
            "accept": "*/*",
            "host": "api.example.com",
        },
        "requestContext": {
            "http": {
                "method": "GET",
                "path": "/non-existent-endpoint",
                "protocol": "HTTP/1.1",
                "sourceIp": "127.0.0.1",
                "userAgent": "pytest",
            }
        },
        "isBase64Encoded": False,
    }

    response = lambda_handler(event, MockLambdaContext())
    assert response["statusCode"] == 404
