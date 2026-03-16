output "endpoint" {
  description = "RDS 엔드포인트 주소 (호스트명만, 포트 제외)"
  value       = aws_db_instance.this.address
}

output "port" {
  description = "RDS 포트"
  value       = aws_db_instance.this.port
}

output "username" {
  description = "RDS 마스터 사용자 이름"
  value       = var.db_username
}
