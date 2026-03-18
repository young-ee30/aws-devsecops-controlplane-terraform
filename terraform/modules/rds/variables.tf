variable "name_prefix" {
  description = "Resource name prefix"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for RDS"
  type        = list(string)
}

variable "ecs_sg_id" {
  description = "ECS security group ID allowed to reach RDS"
  type        = string
}

variable "bastion_sg_id" {
  description = "Optional Bastion security group ID allowed to reach RDS"
  type        = string
  default     = null
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "admin"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "tags" {
  type    = map(string)
  default = {}
}
