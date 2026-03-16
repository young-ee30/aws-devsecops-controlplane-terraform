variable "name_prefix" {
  description = "리소스 이름 prefix"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "RDS를 배치할 private 서브넷 ID 목록"
  type        = list(string)
}

variable "ecs_sg_id" {
  description = "ECS 보안그룹 ID (RDS 인바운드 허용 대상)"
  type        = string
}

variable "db_username" {
  description = "RDS 마스터 사용자 이름"
  type        = string
  default     = "admin"
}

variable "db_password" {
  description = "RDS 마스터 비밀번호 (tfvars에 저장하지 말 것)"
  type        = string
  sensitive   = true
}

variable "instance_class" {
  description = "RDS 인스턴스 타입"
  type        = string
  default     = "db.t3.micro"
}

variable "tags" {
  type    = map(string)
  default = {}
}
