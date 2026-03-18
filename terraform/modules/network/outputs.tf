output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = [for key in sort(keys(aws_subnet.public)) : aws_subnet.public[key].id]
}

output "private_subnet_ids" {
  value = [for key in sort(keys(aws_subnet.private)) : aws_subnet.private[key].id]
}

output "public_subnet_ids_by_key" {
  value = { for key, subnet in aws_subnet.public : key => subnet.id }
}

output "private_subnet_ids_by_key" {
  value = { for key, subnet in aws_subnet.private : key => subnet.id }
}
